import type { Database } from "sql.js";
import { MIGRATION_STEPS } from "./steps.js";

function setStoreSchemaVersion(db: Database, nextVersion: number): void {
  const statement = db.prepare(`
    INSERT INTO meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `);
  statement.run(["store_schema_version", String(nextVersion)]);
  statement.free();
}

function writeMigrationHistory(
  db: Database,
  migrationId: string,
  fromVersion: number,
  toVersion: number,
  checksum: string,
  status: "SUCCESS" | "FAILED",
  startedAt: string,
  finishedAt: string,
  errorMessage: string | null
): void {
  const statement = db.prepare(`
    INSERT INTO migration_history (
      id,
      from_version,
      to_version,
      checksum,
      started_at,
      finished_at,
      status,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  statement.run([
    migrationId,
    fromVersion,
    toVersion,
    checksum,
    startedAt,
    finishedAt,
    status,
    errorMessage,
  ]);
  statement.free();
}

export function runPendingMigrations(db: Database, currentVersion: number, targetVersion: number): void {
  let versionCursor = currentVersion;
  if (versionCursor >= targetVersion) {
    return;
  }

  const steps = MIGRATION_STEPS
    .filter((item) => item.fromVersion >= currentVersion && item.toVersion <= targetVersion)
    .sort((a, b) => a.fromVersion - b.fromVersion);

  for (const step of steps) {
    if (step.fromVersion !== versionCursor) {
      throw new Error(`Migration chain broken at version ${versionCursor}. Missing step ${versionCursor} -> ${step.toVersion}.`);
    }

    const startedAt = new Date().toISOString();
    try {
      db.exec("BEGIN TRANSACTION;");
      step.up(db);
      setStoreSchemaVersion(db, step.toVersion);
      const finishedAt = new Date().toISOString();
      writeMigrationHistory(
        db,
        step.id,
        step.fromVersion,
        step.toVersion,
        step.checksum,
        "SUCCESS",
        startedAt,
        finishedAt,
        null
      );
      db.exec("COMMIT;");
      versionCursor = step.toVersion;
    } catch (error) {
      db.exec("ROLLBACK;");
      const finishedAt = new Date().toISOString();
      writeMigrationHistory(
        db,
        step.id,
        step.fromVersion,
        step.toVersion,
        step.checksum,
        "FAILED",
        startedAt,
        finishedAt,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  if (versionCursor !== targetVersion) {
    throw new Error(`Migration target not reached. expected=${targetVersion}, actual=${versionCursor}`);
  }
}
