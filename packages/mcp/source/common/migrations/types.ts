import type { Database } from "sql.js";

export type MigrationStatus = "SUCCESS" | "FAILED";

export type MigrationStep = {
  id: string;
  fromVersion: number;
  toVersion: number;
  checksum: string;
  up: (db: Database) => void;
};
