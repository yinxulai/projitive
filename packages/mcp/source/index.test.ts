import { describe, it, expect, beforeAll, afterAll } from "vitest"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"

const currentFilePath = fileURLToPath(import.meta.url)
const sourceDir = path.dirname(currentFilePath)

describe("index module", () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "projitive-index-test-"))
  })

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it("should export the main server entry point", async () => {
    // Verify the file exists and has the expected structure
    const indexPath = path.join(sourceDir, "index.ts")
    const exists = await fs.access(indexPath).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  })

  it("should have the correct shebang and imports", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const content = await fs.readFile(indexPath, "utf-8")
    
    // Check for shebang
    expect(content.startsWith("#!/usr/bin/env node")).toBe(true)
    
    // Check for key imports
    expect(content).toContain("McpServer")
    expect(content).toContain("StdioServerTransport")
    expect(content).toContain("registerProjectTools")
    expect(content).toContain("registerTaskTools")
    expect(content).toContain("registerRoadmapTools")
  })

  it("should define PROJITIVE_SPEC_VERSION", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const content = await fs.readFile(indexPath, "utf-8")
    
    expect(content).toContain("PROJITIVE_SPEC_VERSION")
    expect(content).toContain('"1.1.0"')
  })

  it("should register all expected tools and resources", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const content = await fs.readFile(indexPath, "utf-8")
    
    // Check for resource registrations
    expect(content).toContain("registerResource")
    expect(content).toContain("governanceWorkspace")
    expect(content).toContain("governanceTasks")
    expect(content).toContain("governanceRoadmap")
    expect(content).toContain("mcpMethodCatalog")
    
    // Check for prompt registrations
    expect(content).toContain("registerPrompt")
    expect(content).toContain("executeTaskWorkflow")
    expect(content).toContain("updateTaskStatusWithEvidence")
    expect(content).toContain("triageProjectGovernance")
  })

  it("should have main function with server startup", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const content = await fs.readFile(indexPath, "utf-8")
    
    expect(content).toContain("async function main")
    expect(content).toContain("server.connect")
    expect(content).toContain("StdioServerTransport")
  })

  it("should render method catalog with all expected methods", async () => {
    const indexPath = path.join(sourceDir, "index.ts")
    const content = await fs.readFile(indexPath, "utf-8")
    
    // Check for method catalog rendering
    expect(content).toContain("MCP Method Catalog")
    expect(content).toContain("projectScan")
    expect(content).toContain("projectLocate")
    expect(content).toContain("projectContext")
    expect(content).toContain("taskNext")
    expect(content).toContain("taskList")
    expect(content).toContain("taskContext")
    expect(content).toContain("taskUpdate")
    expect(content).toContain("taskCalculateConfidence")
    expect(content).toContain("taskCreateValidationHook")
    expect(content).toContain("roadmapList")
    expect(content).toContain("roadmapContext")
    expect(content).toContain("projectNext")
    expect(content).toContain("projectInit")
  })
})
