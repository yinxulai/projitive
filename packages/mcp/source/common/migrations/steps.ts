import type { Database } from "sql.js";
import type { MigrationStep } from "./types.js";

function hasColumn(db: Database, tableName: "tasks" | "roadmaps" | "meta" | "view_state", columnName: string): boolean {
  const result = db.exec(`PRAGMA table_info(${tableName});`);
  if (result.length === 0) {
    return false;
  }

  const rows = result[0].values as unknown[][];
  return rows.some((row) => String(row[1]) === columnName);
}

function ensureRecordVersionColumns(db: Database): void {
  const tables: Array<"tasks" | "roadmaps" | "meta" | "view_state"> = ["tasks", "roadmaps", "meta", "view_state"];
  for (const tableName of tables) {
    if (!hasColumn(db, tableName, "record_version")) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN record_version INTEGER NOT NULL DEFAULT 1;`);
    }
  }
}

function ensurePerformanceIndexes(db: Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status_updated
      ON tasks(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_updated
      ON tasks(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_roadmaps_updated
      ON roadmaps(updated_at DESC);
  `);
}

export const MIGRATION_STEPS: MigrationStep[] = [
  {
    id: "20260313_baseline_v1",
    fromVersion: 0,
    toVersion: 1,
    checksum: "baseline-v1",
    up: () => {
      // Baseline marker for pre-versioned stores.
    },
  },
  {
    id: "20260313_add_record_version_v2",
    fromVersion: 1,
    toVersion: 2,
    checksum: "add-record-version-v2",
    up: (db) => {
      ensureRecordVersionColumns(db);
    },
  },
  {
    id: "20260313_add_indexes_v3",
    fromVersion: 2,
    toVersion: 3,
    checksum: "add-indexes-v3",
    up: (db) => {
      ensurePerformanceIndexes(db);
    },
  },
];
