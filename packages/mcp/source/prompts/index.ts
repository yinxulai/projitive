// 治理工作流程提示

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerQuickStartPrompt } from "./quickStart.js"
import { registerTaskDiscoveryPrompt } from "./taskDiscovery.js"
import { registerTaskExecutionPrompt } from "./taskExecution.js"

export function registerPrompts(server: McpServer): void {
  registerQuickStartPrompt(server)
  registerTaskDiscoveryPrompt(server)
  registerTaskExecutionPrompt(server)
}
