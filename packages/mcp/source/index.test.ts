import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"

const currentFilePath = fileURLToPath(import.meta.url)
const sourceDir = path.dirname(currentFilePath)

// Mock McpServer and StdioServerTransport
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    registerResource: vi.fn(),
    registerPrompt: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}))

// Mock the registration functions
vi.mock("./tools/project.js", () => ({
  registerProjectTools: vi.fn(),
}))

vi.mock("./tools/task.js", () => ({
  registerTaskTools: vi.fn(),
}))

vi.mock("./tools/roadmap.js", () => ({
  registerRoadmapTools: vi.fn(),
}))

vi.mock("./design-context.js", () => ({
  registerDesignContextResources: vi.fn(),
  registerDesignContextPrompts: vi.fn(),
}))

vi.mock("./resources/governance.js", () => ({
  registerGovernanceResources: vi.fn(),
}))

vi.mock("./resources/designs.js", () => ({
  registerDesignFilesResources: vi.fn(),
}))

vi.mock("./prompts/governance.js", () => ({
  registerGovernancePrompts: vi.fn(),
}))

describe("index module", () => {
  let tempDir: string
  let testProjectDir: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "projitive-index-test-"))
    testProjectDir = path.join(tempDir, "test-project")
    await fs.mkdir(testProjectDir)
  })

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should export the main server entry point", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const exists = await fs.access(indexPath).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  })

  it("should have the correct shebang and imports", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const content = await fs.readFile(indexPath, "utf-8")

    expect(content.startsWith("#!/usr/bin/env node")).toBe(true)
    expect(content).toContain("McpServer")
    expect(content).toContain("StdioServerTransport")
    expect(content).toContain("registerTools")
    expect(content).toContain("registerResources")
    expect(content).toContain("registerPrompts")
  })

  it("should define PROJITIVE_SPEC_VERSION as 1.1.0", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const content = await fs.readFile(indexPath, "utf-8")

    expect(content).toContain("PROJITIVE_SPEC_VERSION")
    expect(content).toContain('"1.1.0"')
  })

  it("should have main function with server startup", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const content = await fs.readFile(indexPath, "utf-8")

    expect(content).toContain("async function main")
    expect(content).toContain("server.connect")
    expect(content).toContain("StdioServerTransport")
  })

  it("should register all tool categories", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const content = await fs.readFile(indexPath, "utf-8")

    expect(content).toContain("registerTools(server)")
    expect(content).toContain("registerResources(server, repoRoot)")
    expect(content).toContain("registerPrompts(server)")
    expect(content).toContain("registerDesignContextResources(server)")
    expect(content).toContain("registerDesignContextPrompts(server)")
  })

  it("should have proper error handling in main", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const content = await fs.readFile(indexPath, "utf-8")

    expect(content).toContain("void main().catch")
    expect(content).toContain("console.error(\"Server error:\", error)")
    expect(content).toContain("process.exit(1)")
  })

  it("should log server startup information", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const content = await fs.readFile(indexPath, "utf-8")

    expect(content).toContain("console.error(`[projitive-mcp] starting server`)")
    expect(content).toContain("console.error(`[projitive-mcp] version=")
    expect(content).toContain("spec=")
    expect(content).toContain("transport=stdio")
    expect(content).toContain("pid=")
  })

  it("should define MCP server with correct metadata", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const content = await fs.readFile(indexPath, "utf-8")

    expect(content).toContain("name: \"projitive\"")
    expect(content).toContain("version: MCP_RUNTIME_VERSION")
    expect(content).toContain("description:")
  })
})
