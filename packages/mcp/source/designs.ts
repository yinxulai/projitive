import { isValidRoadmapId } from "./tools/roadmap.js";
import { isValidTaskId } from "./tools/task.js";

export type DesignMetadata = {
  task?: string;
  roadmap?: string;
  owner?: string;
  status?: string;
  lastUpdated?: string;
};

export function parseDesignMetadata(markdown: string): DesignMetadata {
  const lines = markdown.split(/\r?\n/);
  const metadata: DesignMetadata = {};

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
    if (key === "status") metadata.status = value;
    if (key === "last updated") metadata.lastUpdated = value;
  }

  return metadata;
}

export function validateDesignMetadata(metadata: DesignMetadata): { ok: boolean; errors: string[] } {
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
