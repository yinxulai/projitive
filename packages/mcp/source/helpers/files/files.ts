// 文件相关的辅助函数

export type GovernanceFileEntry = {
  name: string;
  kind: "file" | "directory";
  path: string;
  exists: boolean;
  lineCount?: number;
  markdownFiles?: Array<{ path: string; lineCount: number }>;
};

// 从 common/files.ts 重新导出核心功能
export { discoverGovernanceArtifacts } from "../../common/files.js";
