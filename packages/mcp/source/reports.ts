import { isValidRoadmapId } from "./roadmap.js";
import { isValidTaskId } from "./tasks.js";

export type ReportMetadata = {
  task?: string;
  roadmap?: string;
  owner?: string;
  date?: string;
};

export function parseReportMetadata(markdown: string): ReportMetadata {
  const lines = markdown.split(/\r?\n/);
  const metadata: ReportMetadata = {};

  for (const line of lines) {
    // Remove markdown bold markers (**)
    const cleanLine = line.replace(/\*\*/g, "");
    const [rawKey, ...rawValue] = cleanLine.split(":");
    if (!rawKey || rawValue.length === 0) {
      continue;
    }
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.join(":").trim();

    if (key === "task") metadata.task = value;
    if (key === "roadmap") metadata.roadmap = value;
    if (key === "owner") metadata.owner = value;
    if (key === "date") metadata.date = value;
  }

  return metadata;
}

export function validateReportMetadata(metadata: ReportMetadata): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!metadata.task) {
    errors.push("Missing Task metadata");
  } else if (!isValidTaskId(metadata.task)) {
    errors.push(`Invalid Task metadata format: ${metadata.task}`);
  }

  if (metadata.roadmap && !isValidRoadmapId(metadata.roadmap)) {
    errors.push(`Invalid Roadmap metadata format: ${metadata.roadmap}`);
  }

  return { ok: errors.length === 0, errors };
}
