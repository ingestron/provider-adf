// Native ADF orchestration for a bounded Batch task using managed identities.
const expression = (value) => ({ type: "Expression", value });
const after = (activity) => [{ activity, dependencyConditions: ["Succeeded"] }];
const dynamic = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.includes("__RUN_ID__")
    ? expression(
        "@concat(" +
          text
            .split("__RUN_ID__")
            .map((s) => "'" + s.replaceAll("'", "''") + "'")
            .join(", pipeline().RunId, ") +
          ")",
      )
    : text;
};
export function batchRest(
  b,
  storageAccount,
  files,
  timeout = "00.01:00:00",
  workload = {
    entryPoint: "azure_runner.py",
    configFile: "config.json",
    taskId: "extract",
  },
) {
  for (const key of ["entryPoint", "configFile", "taskId"])
    if (
      typeof workload[key] !== "string" ||
      !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,100}$/.test(workload[key])
    )
      throw new Error("Unsafe workload file or task ID");
  if (
    !files.includes(workload.entryPoint) ||
    !files.includes(workload.configFile)
  )
    throw new Error("Workload files are missing");
  if (
    workload.pythonExecutable !== undefined &&
    !/^\/opt\/ingestron\/[A-Za-z0-9_-]+\/bin\/python$/.test(
      workload.pythonExecutable,
    )
  )
    throw new Error(
      "Python executable must be a prepared environment under /opt/ingestron",
    );
  const match = /^(\d+)\.(\d{2}):(\d{2}):(\d{2})$/.exec(timeout);
  if (!match || +match[2] > 23 || +match[3] > 59 || +match[4] > 59)
    throw new Error("Invalid Batch timeout");
  const seconds =
    +match[1] * 86400 + +match[2] * 3600 + +match[3] * 60 + +match[4];
  if (seconds < 60 || seconds > 604800)
    throw new Error("Batch timeout must be one minute to seven days");
  const untilSeconds = seconds + 300;
  const untilTimeout =
    Math.floor(untilSeconds / 86400) +
    "." +
    [
      Math.floor((untilSeconds % 86400) / 3600),
      Math.floor((untilSeconds % 3600) / 60),
      untilSeconds % 60,
    ]
      .map((n) => String(n).padStart(2, "0"))
      .join(":");
  const api = "?api-version=2024-07-01.20.0";
  const web = (name, method, url, body, dependsOn = []) => ({
    name,
    type: "WebActivity",
    dependsOn,
    policy: {
      timeout: "00.00:02:00",
      retry: 0,
      secureInput: true,
      secureOutput: true,
    },
    typeProperties: {
      method,
      url: dynamic(url),
      headers: { "Content-Type": "application/json;odata=minimalmetadata" },
      authentication: {
        type: "MSI",
        resource: "https://batch.core.windows.net/",
      },
      turnOffAsync: true,
      ...(body ? { body: dynamic(body) } : {}),
    },
  });
  const jobs = b.batchAccountUrl + "/jobs",
    job = jobs + "/__RUN_ID__";
  return {
    variables: {
      batchState: { type: "String", defaultValue: "active" },
      batchExit: { type: "String", defaultValue: "-1" },
    },
    activities: [
      web("CreateBatchJob", "POST", jobs + api, {
        id: "__RUN_ID__",
        poolInfo: { poolId: b.poolName },
        constraints: {
          maxWallClockTime: "PT" + untilSeconds + "S",
          maxTaskRetryCount: 0,
        },
      }),
      web(
        "SubmitBatchTask",
        "POST",
        job + "/tasks" + api,
        {
          id: workload.taskId,
          commandLine:
            (workload.pythonExecutable ?? "python") +
            " " +
            workload.entryPoint +
            " --config " +
            workload.configFile +
            " --run-id __RUN_ID__",
          constraints: {
            maxTaskRetryCount: 0,
            maxWallClockTime: "PT" + seconds + "S",
          },
          resourceFiles: files.map((name) => ({
            filePath: name,
            httpUrl:
              "https://" +
              storageAccount +
              ".blob.core.windows.net/" +
              b.resourceFolder +
              "/" +
              name,
            identityReference: { resourceId: b.workerIdentityResourceId },
          })),
        },
        after("CreateBatchJob"),
      ),
      {
        name: "WaitForBatchTask",
        type: "Until",
        dependsOn: after("SubmitBatchTask"),
        typeProperties: {
          timeout: untilTimeout,
          expression: expression(
            "@equals(variables('batchState'), 'completed')",
          ),
          activities: [
            web(
              "ReadBatchTask",
              "GET",
              job +
                "/tasks/" +
                workload.taskId +
                api +
                "&$select=state,executionInfo",
            ),
            {
              name: "RememberState",
              type: "SetVariable",
              dependsOn: after("ReadBatchTask"),
              typeProperties: {
                variableName: "batchState",
                value: expression("@activity('ReadBatchTask').output.state"),
              },
            },
            {
              name: "RememberExit",
              type: "SetVariable",
              dependsOn: after("RememberState"),
              typeProperties: {
                variableName: "batchExit",
                value: expression(
                  "@if(equals(variables('batchState'), 'completed'), string(if(contains(activity('ReadBatchTask').output.executionInfo, 'exitCode'), coalesce(activity('ReadBatchTask').output.executionInfo.exitCode, -1), -1)), '-1')",
                ),
              },
            },
            {
              name: "PollDelay",
              type: "Wait",
              dependsOn: after("RememberExit"),
              typeProperties: {
                waitTimeInSeconds: b.pollIntervalSeconds ?? 300,
              },
            },
          ],
        },
      },
      web(
        "TerminateBatchJob",
        "POST",
        job + "/terminate" + api,
        { terminateReason: "ADF task completed" },
        [{ activity: "WaitForBatchTask", dependencyConditions: ["Completed"] }],
      ),
      {
        name: "CheckBatchResult",
        type: "IfCondition",
        dependsOn: after("TerminateBatchJob"),
        typeProperties: {
          expression: expression("@equals(variables('batchExit'), '0')"),
          ifTrueActivities: [],
          ifFalseActivities: [
            {
              name: "BatchTaskFailed",
              type: "Fail",
              typeProperties: {
                message:
                  "Batch task failed. Inspect job state and credential recovery before retrying.",
                errorCode: "BatchTaskFailed",
              },
            },
          ],
        },
      },
    ],
  };
}
