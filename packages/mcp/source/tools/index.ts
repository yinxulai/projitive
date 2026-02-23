import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerProjectTools } from "./project.js"
import { registerTaskTools } from "./task.js"
import { registerRoadmapTools } from "./roadmap.js"

export function registerTools(server: McpServer): void {
  registerProjectTools(server)
  registerTaskTools(server)
  registerRoadmapTools(server)
}