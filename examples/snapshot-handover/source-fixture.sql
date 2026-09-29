-- Synthetic fixture: run only in an authorised scratch SQL database.
-- CREATE fails if the table exists; this script does not overwrite existing data.
CREATE TABLE dbo.IngestronSnapshotDemo (
  id BIGINT NOT NULL PRIMARY KEY,
  name NVARCHAR(100) NULL
);
INSERT INTO dbo.IngestronSnapshotDemo (id, name)
VALUES (1, N'Example customer one'), (2, N'Example customer two');
-- Keep the table unchanged throughout Copy. Only change this scratch fixture
-- after the run finishes, and issue a new source delivery ID/version/capture time.
