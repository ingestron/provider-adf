/** Versioned SQL control assets, generated for review and never applied by the compiler. */
export const watermarkControlSql = `-- Ingestron native append checkpoint and committed-delivery journal, protocol v1.
-- Apply through independently reviewed deployment to a dedicated control database.
-- Grant the pipeline EXECUTE on these procedures; journal consumers need SELECT only.
-- Existing state is never reset. Failed landing folders are never journal publications.
SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.IngestronWatermarkV1', N'U') IS NULL
BEGIN
 CREATE TABLE dbo.IngestronWatermarkV1 (
  Dataset nvarchar(400) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
  PlanDigest char(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
  Watermark bigint NOT NULL CHECK (Watermark >= 0)
 );
END;
IF OBJECT_ID(N'dbo.IngestronDeliveryV1', N'U') IS NULL
BEGIN
 CREATE TABLE dbo.IngestronDeliveryV1 (
  Dataset nvarchar(400) COLLATE Latin1_General_100_BIN2 NOT NULL,
  RunId uniqueidentifier NOT NULL,
  PlanDigest char(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
  LowerWatermark bigint NOT NULL,
  UpperWatermark bigint NOT NULL,
  [RowCount] int NOT NULL CHECK ([RowCount] > 0 AND [RowCount] <= 1000000),
  LandingPath nvarchar(1000) COLLATE Latin1_General_100_BIN2 NOT NULL,
  CommittedAt datetime2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY (Dataset, RunId),
  FOREIGN KEY (Dataset) REFERENCES dbo.IngestronWatermarkV1(Dataset),
  CHECK (LowerWatermark >= 0 AND UpperWatermark > LowerWatermark)
 );
END;
GO
CREATE OR ALTER PROCEDURE dbo.IngestronReadWatermarkV1
 @Dataset nvarchar(max), @PlanDigest varchar(max), @Initial varchar(max)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @InitialValue bigint = TRY_CONVERT(bigint, @Initial);
 IF @InitialValue IS NULL OR @InitialValue < 0 OR @Initial IS NULL
  OR DATALENGTH(@Initial) <> DATALENGTH(CONVERT(varchar(20), @InitialValue))
  OR @Initial COLLATE Latin1_General_100_BIN2 <> CONVERT(varchar(20), @InitialValue)
  THROW 51000, 'Initial watermark must be a canonical non-negative int64 string', 1;
 IF @Dataset IS NULL OR DATALENGTH(@Dataset) = 0 OR DATALENGTH(@Dataset) > 800
  OR @Dataset COLLATE Latin1_General_100_BIN2 LIKE N'%[^a-zA-Z0-9_.-]%'
  THROW 51001, 'Invalid checkpoint dataset identity', 1;
 IF @PlanDigest IS NULL OR DATALENGTH(@PlanDigest) <> 64
  OR @PlanDigest COLLATE Latin1_General_100_BIN2 LIKE '%[^0-9a-f]%'
  THROW 51002, 'Invalid plan identity', 1;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @StoredDigest char(64), @Value bigint;
  SELECT @StoredDigest = PlanDigest, @Value = Watermark
   FROM dbo.IngestronWatermarkV1 WITH (UPDLOCK, HOLDLOCK) WHERE Dataset = @Dataset;
  IF @StoredDigest IS NULL
  BEGIN
   INSERT dbo.IngestronWatermarkV1 (Dataset, PlanDigest, Watermark) VALUES (@Dataset, @PlanDigest, @InitialValue);
   SET @StoredDigest = @PlanDigest; SET @Value = @InitialValue;
  END;
  IF @StoredDigest COLLATE Latin1_General_100_BIN2 <> @PlanDigest COLLATE Latin1_General_100_BIN2
   THROW 51003, 'Checkpoint plan changed; review a separate state namespace or an explicit migration', 1;
  COMMIT TRANSACTION;
  SELECT CONVERT(varchar(20), @Value) AS watermark;
 END TRY
 BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.IngestronValidateBatchV1
 @Dataset nvarchar(max), @PlanDigest varchar(max),
 @Expected varchar(max), @Next varchar(max), @RunId varchar(max)
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Low bigint = TRY_CONVERT(bigint, @Expected), @High bigint = TRY_CONVERT(bigint, @Next),
  @Run uniqueidentifier = TRY_CONVERT(uniqueidentifier, @RunId);
 IF @Low IS NULL OR @High IS NULL OR @Low < 0 OR @High <= @Low
  OR DATALENGTH(@Expected) <> DATALENGTH(CONVERT(varchar(20), @Low))
  OR DATALENGTH(@Next) <> DATALENGTH(CONVERT(varchar(20), @High))
  OR @Expected COLLATE Latin1_General_100_BIN2 <> CONVERT(varchar(20), @Low)
  OR @Next COLLATE Latin1_General_100_BIN2 <> CONVERT(varchar(20), @High)
  THROW 51004, 'Invalid canonical batch interval', 1;
 IF @Run IS NULL OR DATALENGTH(@RunId) <> 36
  OR @RunId COLLATE Latin1_General_100_BIN2 <> LOWER(CONVERT(varchar(36), @Run)) COLLATE Latin1_General_100_BIN2
  THROW 51005, 'Invalid canonical pipeline run identity', 1;
 IF @Dataset IS NULL OR DATALENGTH(@Dataset) = 0 OR DATALENGTH(@Dataset) > 800
  OR @Dataset COLLATE Latin1_General_100_BIN2 LIKE N'%[^a-zA-Z0-9_.-]%'
  OR @PlanDigest IS NULL OR DATALENGTH(@PlanDigest) <> 64
  OR @PlanDigest COLLATE Latin1_General_100_BIN2 LIKE '%[^0-9a-f]%'
  THROW 51006, 'Invalid batch dataset or plan identity', 1;
 IF NOT EXISTS (SELECT 1 FROM dbo.IngestronWatermarkV1 WHERE Dataset = @Dataset
  AND PlanDigest = @PlanDigest AND Watermark = @Low)
  THROW 51007, 'Checkpoint changed; this batch cannot start', 1;
 SELECT CONVERT(varchar(20), @Low) AS lowerWatermark, CONVERT(varchar(20), @High) AS upperWatermark,
  LOWER(CONVERT(varchar(36), @Run)) AS runId;
END;
GO
CREATE OR ALTER PROCEDURE dbo.IngestronCommitWatermarkV1
 @Dataset nvarchar(max), @RunId varchar(max), @PlanDigest varchar(max),
 @Expected varchar(max), @Next varchar(max), @RowCount int, @LandingPath nvarchar(max)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Low bigint = TRY_CONVERT(bigint, @Expected), @High bigint = TRY_CONVERT(bigint, @Next),
  @Run uniqueidentifier = TRY_CONVERT(uniqueidentifier, @RunId);
 IF @Low IS NULL OR @High IS NULL OR @Low < 0 OR @High <= @Low
  OR @RowCount IS NULL OR @RowCount <= 0 OR @RowCount > 1000000
  OR DATALENGTH(@Expected) <> DATALENGTH(CONVERT(varchar(20), @Low))
  OR DATALENGTH(@Next) <> DATALENGTH(CONVERT(varchar(20), @High))
  OR @Expected COLLATE Latin1_General_100_BIN2 <> CONVERT(varchar(20), @Low)
  OR @Next COLLATE Latin1_General_100_BIN2 <> CONVERT(varchar(20), @High)
  THROW 51008, 'Invalid bounded checkpoint transition', 1;
 IF @Run IS NULL OR DATALENGTH(@RunId) <> 36
  OR @RunId COLLATE Latin1_General_100_BIN2 <> LOWER(CONVERT(varchar(36), @Run)) COLLATE Latin1_General_100_BIN2
  OR @LandingPath IS NULL OR DATALENGTH(@LandingPath) = 0 OR DATALENGTH(@LandingPath) > 2000
  THROW 51009, 'A canonical delivery identity and bounded landing location are required', 1;
 IF @Dataset IS NULL OR DATALENGTH(@Dataset) = 0 OR DATALENGTH(@Dataset) > 800
  OR @Dataset COLLATE Latin1_General_100_BIN2 LIKE N'%[^a-zA-Z0-9_.-]%'
  OR @PlanDigest IS NULL OR DATALENGTH(@PlanDigest) <> 64
  OR @PlanDigest COLLATE Latin1_General_100_BIN2 LIKE '%[^0-9a-f]%'
  THROW 51010, 'Invalid delivery dataset or plan identity', 1;
 BEGIN TRY
  BEGIN TRANSACTION;
  -- Always lock the dataset before its receipts so concurrent writers use the same lock order.
  DECLARE @StoredDigest char(64), @Value bigint;
  SELECT @StoredDigest = PlanDigest, @Value = Watermark
   FROM dbo.IngestronWatermarkV1 WITH (UPDLOCK, HOLDLOCK) WHERE Dataset = @Dataset;
  IF @StoredDigest IS NULL OR @StoredDigest COLLATE Latin1_General_100_BIN2 <> @PlanDigest COLLATE Latin1_General_100_BIN2
   THROW 51011, 'Checkpoint identity changed or was not initialised', 1;
  IF EXISTS (SELECT 1 FROM dbo.IngestronDeliveryV1 WHERE Dataset = @Dataset AND RunId = @Run)
  BEGIN
   IF NOT EXISTS (SELECT 1 FROM dbo.IngestronDeliveryV1 WHERE Dataset = @Dataset AND RunId = @Run
     AND PlanDigest = @PlanDigest AND LowerWatermark = @Low AND UpperWatermark = @High
     AND [RowCount] = @RowCount AND LandingPath = @LandingPath
     AND DATALENGTH(LandingPath) = DATALENGTH(@LandingPath))
    THROW 51012, 'Run identity was already committed with different evidence', 1;
   COMMIT TRANSACTION; RETURN;
  END;
  IF @Value <> @Low
   THROW 51013, 'Another run already advanced the checkpoint; this landing is unpublished', 1;
  UPDATE dbo.IngestronWatermarkV1 SET Watermark = @High WHERE Dataset = @Dataset AND PlanDigest = @PlanDigest AND Watermark = @Low;
  IF @@ROWCOUNT <> 1 THROW 51014, 'Checkpoint changed before commit', 1;
  INSERT dbo.IngestronDeliveryV1 (Dataset,RunId,PlanDigest,LowerWatermark,UpperWatermark,[RowCount],LandingPath)
   VALUES (@Dataset,@Run,@PlanDigest,@Low,@High,@RowCount,@LandingPath);
  COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
`;
