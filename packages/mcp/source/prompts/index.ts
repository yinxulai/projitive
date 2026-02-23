// 治理工作流程提示

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerDiscoverAndStartGovernancePrompt } from "./discoverAndStartGovernance.js"
import { registerFindAndExecuteFirstTaskPrompt } from "./findAndExecuteFirstTask.js"
import { registerExecuteTaskWorkflowPrompt } from "./executeTaskWorkflow.js"

export function registerPrompts(server: McpServer): void {
  registerDiscoverAndStartGovernancePrompt(server)
  registerFindAndExecuteFirstTaskPrompt(server)
  registerExecuteTaskWorkflowPrompt(server)
}
