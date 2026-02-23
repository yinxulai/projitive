import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerGovernanceResources } from "./governance.js"
import { registerDesignFilesResources } from "./designs.js"

export function registerResources(server: McpServer, repoRoot: string): void {
  registerGovernanceResources(server, repoRoot)
  registerDesignFilesResources(server, repoRoot)
}
