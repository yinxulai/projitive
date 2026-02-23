import type { GovernanceFileEntry } from "../../common/files.js";

export function candidateFilesFromArtifacts(artifacts: GovernanceFileEntry[]): string[] {
  return artifacts
    .filter((item) => item.exists)
    .flatMap((item) => {
      if (item.kind === "file") {
        return [item.path];
      }
      return (item.markdownFiles ?? []).map((entry) => entry.path);
    });
}
