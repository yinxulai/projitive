#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import packageJson from "../package.json" with { type: "json" }
import { registerTools } from "./tools/index.js"
import { registerPrompts } from "./prompts/index.js"
import { registerResources } from "./resources/index.js"

const PROJITIVE_SPEC_VERSION = "1.1.0"

const currentFilePath = fileURLToPath(import.meta.url)
const sourceDir = path.dirname(currentFilePath)
const repoRoot = path.resolve(sourceDir, "..", "..", "..")

const MCP_RUNTIME_VERSION = typeof packageJson.version === "string" && packageJson.version.trim().length > 0
  ? packageJson.version.trim()
  : PROJITIVE_SPEC_VERSION

const server = new McpServer({
  name: "projitive",
  version: MCP_RUNTIME_VERSION,
  description: "Semantic Projitive MCP for project/task discovery and agent guidance with markdown-first outputs",
})

// 注册所有模块
registerTools(server)
registerPrompts(server)
registerResources(server, repoRoot)

async function main(): Promise<void> {
  console.error(`[projitive-mcp] starting server`)
  console.error(`[projitive-mcp] version=${MCP_RUNTIME_VERSION} spec=${PROJITIVE_SPEC_VERSION} transport=stdio pid=${process.pid}`)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

void main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})
