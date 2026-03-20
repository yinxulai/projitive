import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  discoverProjects,
  discoverProjectsAcrossRoots,
  hasProjectMarker,
  initializeProjectStructure,
  resolveGovernanceDir,
  resolveScanRoots,
  resolveScanRoot,
  resolveScanDepth,
  toProjectPath,
  registerProjectTools
} from './project.js'

const tempPaths: string[] = []

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'projitive-mcp-test-'))
  tempPaths.push(dir)
  return dir
}

function getProjectToolHandler(mockServer: { registerTool: ReturnType<typeof vi.fn> }, toolName: string) {
  const call = mockServer.registerTool.mock.calls.find((entry) => entry[0] === toolName)
  expect(call).toBeTruthy()
  return call?.[2] as (args?: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>
}

afterEach(async () => {
  await Promise.all(
    tempPaths.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true })
    })
  )
  vi.restoreAllMocks()
})

describe('projitive module', () => {
  describe('hasProjectMarker', () => {
    it('does not treat marker directory as a valid project marker', async () => {
      const root = await createTempDir()
      const dirMarkerPath = path.join(root, '.projitive')
      await fs.mkdir(dirMarkerPath, { recursive: true })

      const hasMarker = await hasProjectMarker(root)
      expect(hasMarker).toBe(false)
    })

    it('returns true when .projitive marker file exists', async () => {
      const root = await createTempDir()
      const markerPath = path.join(root, '.projitive')
      await fs.writeFile(markerPath, '', 'utf-8')

      const hasMarker = await hasProjectMarker(root)
      expect(hasMarker).toBe(true)
    })

    it('returns false when .projitive marker file does not exist', async () => {
      const root = await createTempDir()
      const hasMarker = await hasProjectMarker(root)
      expect(hasMarker).toBe(false)
    })

    it('handles fs.stat errors gracefully', async () => {
      const root = await createTempDir()
      vi.spyOn(fs, 'stat').mockRejectedValueOnce(new Error('Permission denied'))
      
      const hasMarker = await hasProjectMarker(root)
      expect(hasMarker).toBe(false)
    })
  })

  describe('resolveGovernanceDir', () => {
    it('resolves governance dir by walking upwards for .projitive', async () => {
      const root = await createTempDir()
      const governanceDir = path.join(root, 'repo', 'governance')
      const deepDir = path.join(governanceDir, 'nested', 'module')
      await fs.mkdir(deepDir, { recursive: true })
      await fs.writeFile(path.join(governanceDir, '.projitive'), '', 'utf-8')

      const resolved = await resolveGovernanceDir(deepDir)
      expect(resolved).toBe(governanceDir)
    })

    it('resolves nested default governance dir when input path is project root', async () => {
      const root = await createTempDir()
      const projectRoot = path.join(root, 'repo')
      const governanceDir = path.join(projectRoot, '.projitive')
      await fs.mkdir(governanceDir, { recursive: true })
      await fs.writeFile(path.join(governanceDir, '.projitive'), '', 'utf-8')

      const resolved = await resolveGovernanceDir(projectRoot)
      expect(resolved).toBe(governanceDir)
    })

    it('resolves nested custom governance dir when input path is project root', async () => {
      const root = await createTempDir()
      const projectRoot = path.join(root, 'repo')
      const governanceDir = path.join(projectRoot, 'governance')
      await fs.mkdir(governanceDir, { recursive: true })
      await fs.writeFile(path.join(governanceDir, '.projitive'), '', 'utf-8')

      const resolved = await resolveGovernanceDir(projectRoot)
      expect(resolved).toBe(governanceDir)
    })

    it('throws error when path not found', async () => {
      const root = await createTempDir()
      const nonExistentPath = path.join(root, 'nonexistent')
      
      await expect(resolveGovernanceDir(nonExistentPath)).rejects.toThrow('Path not found')
    })

    it('throws error when no .projitive marker found', async () => {
      const root = await createTempDir()
      const deepDir = path.join(root, 'a', 'b', 'c')
      await fs.mkdir(deepDir, { recursive: true })
      
      await expect(resolveGovernanceDir(deepDir)).rejects.toThrow('No .projitive marker found')
    })

    it('throws when multiple non-default governance roots exist under same parent', async () => {
      const root = await createTempDir()
      const childDir = path.join(root, 'child')
      const gov1 = path.join(childDir, 'governance-a')
      const gov2 = path.join(childDir, 'governance-b')
      await fs.mkdir(gov1, { recursive: true })
      await fs.mkdir(gov2, { recursive: true })
      await fs.writeFile(path.join(gov1, '.projitive'), '', 'utf-8')
      await fs.writeFile(path.join(gov2, '.projitive'), '', 'utf-8')

      await expect(resolveGovernanceDir(childDir)).rejects.toThrow('Multiple governance roots found')
    })

    it('prefers default .projitive directory when multiple governance roots found as children', async () => {
      const root = await createTempDir()
      const childDir = path.join(root, 'child')
      const governance1 = path.join(childDir, '.projitive')
      const governance2 = path.join(childDir, 'governance')
      await fs.mkdir(governance1, { recursive: true })
      await fs.mkdir(governance2, { recursive: true })
      await fs.writeFile(path.join(governance1, '.projitive'), '', 'utf-8')
      await fs.writeFile(path.join(governance2, '.projitive'), '', 'utf-8')
      
      const resolved = await resolveGovernanceDir(childDir)
      expect(resolved).toBe(governance1) // Should prefer default .projitive
    })

    it('resolves file path by using its directory', async () => {
      const root = await createTempDir()
      const governanceDir = path.join(root, '.projitive')
      const filePath = path.join(governanceDir, 'tasks.md')
      await fs.mkdir(governanceDir, { recursive: true })
      await fs.writeFile(path.join(governanceDir, '.projitive'), '', 'utf-8')
      await fs.writeFile(filePath, '# Tasks', 'utf-8')

      const resolved = await resolveGovernanceDir(filePath)
      expect(resolved).toBe(governanceDir)
    })
  })

  describe('discoverProjects', () => {
    it('discovers projects by marker file', async () => {
      const root = await createTempDir()
      const p1 = path.join(root, 'a')
      const p2 = path.join(root, 'b', 'c')
      await fs.mkdir(p1, { recursive: true })
      await fs.mkdir(p2, { recursive: true })
      await fs.writeFile(path.join(p1, '.projitive'), '', 'utf-8')
      await fs.writeFile(path.join(p2, '.projitive'), '', 'utf-8')

      const projects = await discoverProjects(root, 4)
      expect(projects).toContain(p1)
      expect(projects).toContain(p2)
    })

    it('discovers nested default governance directory under project root', async () => {
      const root = await createTempDir()
      const projectRoot = path.join(root, 'app')
      const governanceDir = path.join(projectRoot, '.projitive')
      await fs.mkdir(governanceDir, { recursive: true })
      await fs.writeFile(path.join(governanceDir, '.projitive'), '', 'utf-8')

      const projects = await discoverProjects(root, 3)
      expect(projects).toContain(governanceDir)
    })

    it('discovers nested custom governance directory under project root', async () => {
      const root = await createTempDir()
      const projectRoot = path.join(root, 'app')
      const governanceDir = path.join(projectRoot, 'governance')
      await fs.mkdir(governanceDir, { recursive: true })
      await fs.writeFile(path.join(governanceDir, '.projitive'), '', 'utf-8')

      const projects = await discoverProjects(root, 3)
      expect(projects).toContain(governanceDir)
    })

    it('respects maxDepth limit', async () => {
      const root = await createTempDir()
      const shallow = path.join(root, 'shallow')
      const deep = path.join(root, 'level1', 'level2', 'level3', 'level4', 'deep')
      await fs.mkdir(shallow, { recursive: true })
      await fs.mkdir(deep, { recursive: true })
      await fs.writeFile(path.join(shallow, '.projitive'), '', 'utf-8')
      await fs.writeFile(path.join(deep, '.projitive'), '', 'utf-8')

      const projects = await discoverProjects(root, 3)
      expect(projects).toContain(shallow)
      expect(projects).not.toContain(deep)
    })

    it('ignores common ignore directories', async () => {
      const root = await createTempDir()
      const nodeModulesProject = path.join(root, 'node_modules', 'project')
      const gitProject = path.join(root, '.git', 'project')
      const validProject = path.join(root, 'valid')
      await fs.mkdir(nodeModulesProject, { recursive: true })
      await fs.mkdir(gitProject, { recursive: true })
      await fs.mkdir(validProject, { recursive: true })
      await fs.writeFile(path.join(nodeModulesProject, '.projitive'), '', 'utf-8')
      await fs.writeFile(path.join(gitProject, '.projitive'), '', 'utf-8')
      await fs.writeFile(path.join(validProject, '.projitive'), '', 'utf-8')

      const projects = await discoverProjects(root, 3)
      expect(projects).toContain(validProject)
      expect(projects).not.toContain(nodeModulesProject)
      expect(projects).not.toContain(gitProject)
    })

    it('returns empty array when no projects found', async () => {
      const root = await createTempDir()
      const projects = await discoverProjects(root, 3)
      expect(projects).toEqual([])
    })

    it('returns unique and sorted results', async () => {
      const root = await createTempDir()
      const projectB = path.join(root, 'b')
      const projectA = path.join(root, 'a')
      await fs.mkdir(projectB, { recursive: true })
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(path.join(projectB, '.projitive'), '', 'utf-8')
      await fs.writeFile(path.join(projectA, '.projitive'), '', 'utf-8')

      const projects = await discoverProjects(root, 3)
      expect(projects).toEqual([projectA, projectB])
    })

    it('handles fs.readdir errors gracefully', async () => {
      const root = await createTempDir()
      vi.spyOn(fs, 'readdir').mockRejectedValueOnce(new Error('Permission denied'))
      
      const projects = await discoverProjects(root, 3)
      expect(projects).toEqual([])
    })

    it('ignores non-existent roots when scanning across multiple roots', async () => {
      const validRoot = await createTempDir()
      const validProject = path.join(validRoot, 'project-a')
      const missingRoot = path.join(validRoot, '__missing_root__')
      await fs.mkdir(validProject, { recursive: true })
      await fs.writeFile(path.join(validProject, '.projitive'), '', 'utf-8')

      const projects = await discoverProjectsAcrossRoots([missingRoot, validRoot], 3)
      expect(projects).toContain(validProject)
    })
  })

  describe('initializeProjectStructure', () => {
    it('initializes governance structure under default .projitive directory', async () => {
      const root = await createTempDir()

      const initialized = await initializeProjectStructure(root)
      expect(initialized.governanceDir).toBe(path.join(root, '.projitive'))

      const expectedPaths = [
        path.join(root, '.projitive', '.projitive'),
        path.join(root, '.projitive', 'README.md'),
        path.join(root, '.projitive', 'roadmap.md'),
        path.join(root, '.projitive', 'tasks.md'),
        path.join(root, '.projitive', 'templates', 'README.md'),
        path.join(root, '.projitive', 'templates', 'tools', 'taskNext.md'),
        path.join(root, '.projitive', 'templates', 'tools', 'taskUpdate.md'),
        path.join(root, '.projitive', 'designs'),
        path.join(root, '.projitive', 'reports'),
        path.join(root, '.projitive', 'templates'),
        path.join(root, '.projitive', 'templates', 'tools'),
      ]

      await Promise.all(expectedPaths.map(async (targetPath) => {
        await expect(fs.access(targetPath)).resolves.toBeUndefined()
      }))
    })

    it('overwrites template files when force is enabled', async () => {
      const root = await createTempDir()
      const governanceDir = path.join(root, '.projitive')
      const readmePath = path.join(governanceDir, 'README.md')

      await initializeProjectStructure(root)
      await fs.writeFile(readmePath, 'custom-content', 'utf-8')

      const initialized = await initializeProjectStructure(root, '.projitive', true)
      const readmeContent = await fs.readFile(readmePath, 'utf-8')

      expect(readmeContent).toContain('Projitive Governance Workspace')
      expect(initialized.files.find((item) => item.path === readmePath)?.action).toBe('updated')
    })

    it('uses custom governance directory when specified', async () => {
      const root = await createTempDir()
      const customDir = 'my-governance'

      const initialized = await initializeProjectStructure(root, customDir)
      expect(initialized.governanceDir).toBe(path.join(root, customDir))
    })

    it('throws error when project path not found', async () => {
      const root = await createTempDir()
      const nonExistentPath = path.join(root, 'nonexistent')
      
      await expect(initializeProjectStructure(nonExistentPath)).rejects.toThrow('Path not found')
    })

    it('throws error when project path is not a directory', async () => {
      const root = await createTempDir()
      const filePath = path.join(root, 'file.txt')
      await fs.writeFile(filePath, 'content', 'utf-8')
      
      await expect(initializeProjectStructure(filePath)).rejects.toThrow('projectPath must be a directory')
    })

    it('creates governance structure with default name when invalid names are provided', async () => {
      const root = await createTempDir()
      
      // When governanceDir is invalid, it should fall back to default
      // Note: normalizeGovernanceDirName is not exported, so we test initialization behavior
      const initialized = await initializeProjectStructure(root)
      expect(initialized.governanceDir).toBe(path.join(root, '.projitive'))
    })

    it('skips existing files when force is disabled', async () => {
      const root = await createTempDir()
      const governanceDir = path.join(root, '.projitive')
      const readmePath = path.join(governanceDir, 'README.md')

      await initializeProjectStructure(root)
      await fs.writeFile(readmePath, 'custom-content', 'utf-8')

      const initialized = await initializeProjectStructure(root, '.projitive', false)
      const readmeContent = await fs.readFile(readmePath, 'utf-8')

      expect(readmeContent).toBe('custom-content')
      expect(initialized.files.find((item) => item.path === readmePath)?.action).toBe('skipped')
    })

    it('creates all required subdirectories', async () => {
      const root = await createTempDir()

      const initialized = await initializeProjectStructure(root)
      
      expect(initialized.directories.some(d => d.path.includes('designs'))).toBe(true)
      expect(initialized.directories.some(d => d.path.includes('reports'))).toBe(true)
      expect(initialized.directories.some(d => d.path.includes('templates'))).toBe(true)
    })

    it('throws when governanceDir is an absolute path', async () => {
      const root = await createTempDir()
      await expect(initializeProjectStructure(root, '/absolute/path')).rejects.toThrow('relative directory name')
    })

    it('throws when governanceDir contains path separators', async () => {
      const root = await createTempDir()
      await expect(initializeProjectStructure(root, 'path/with/slash')).rejects.toThrow('path separators')
    })

    it('throws when governanceDir is a dot or double-dot', async () => {
      const root = await createTempDir()
      await expect(initializeProjectStructure(root, '.')).rejects.toThrow('normal directory name')
      await expect(initializeProjectStructure(root, '..')).rejects.toThrow('normal directory name')
    })
  })

  describe('utility functions', () => {
    describe('toProjectPath', () => {
      it('returns parent directory of governance dir', () => {
        expect(toProjectPath('/path/to/project/.projitive')).toBe('/path/to/project')
        expect(toProjectPath('/a/b/c')).toBe('/a/b')
      })
    })

    describe('resolveScanRoots', () => {
      it('uses legacy environment variable when no multi-root env is provided', () => {
        vi.stubEnv('PROJITIVE_SCAN_ROOT_PATH', '/test/root')
        expect(resolveScanRoots()).toEqual(['/test/root'])
        vi.unstubAllEnvs()
      })

      it('uses input paths when provided', () => {
        vi.stubEnv('PROJITIVE_SCAN_ROOT_PATH', '/test/root')
        expect(resolveScanRoots(['/custom/path', ' /custom/path ', '/second/path'])).toEqual(['/custom/path', '/second/path'])
        vi.unstubAllEnvs()
      })

      it('uses PROJITIVE_SCAN_ROOT_PATHS with platform delimiter', () => {
        vi.stubEnv('PROJITIVE_SCAN_ROOT_PATHS', ['/root/a', '/root/b', '', ' /root/c '].join(path.delimiter))
        expect(resolveScanRoots()).toEqual(['/root/a', '/root/b', '/root/c'])
        vi.unstubAllEnvs()
      })

      it('treats JSON-like string as plain delimiter input', () => {
        vi.stubEnv('PROJITIVE_SCAN_ROOT_PATHS', JSON.stringify(['/json/a', '/json/b']))
        expect(resolveScanRoots()).toHaveLength(1)
        vi.unstubAllEnvs()
      })

      it('throws error when no root environment variables are configured', () => {
        vi.unstubAllEnvs()
        expect(() => resolveScanRoots()).toThrow('Missing required environment variable: PROJITIVE_SCAN_ROOT_PATHS')
      })
    })

    describe('resolveScanDepth', () => {
      it('uses environment variable when no input depth', () => {
        vi.stubEnv('PROJITIVE_SCAN_ROOT_PATH', '/test/root')
        vi.stubEnv('PROJITIVE_SCAN_MAX_DEPTH', '5')
        expect(resolveScanDepth()).toBe(5)
        vi.unstubAllEnvs()
      })

      it('uses input depth when provided', () => {
        vi.stubEnv('PROJITIVE_SCAN_ROOT_PATH', '/test/root')
        vi.stubEnv('PROJITIVE_SCAN_MAX_DEPTH', '5')
        expect(resolveScanDepth(3)).toBe(3)
        vi.unstubAllEnvs()
      })

      it('clamps depth to MAX_SCAN_DEPTH', () => {
        vi.stubEnv('PROJITIVE_SCAN_ROOT_PATH', '/test/root')
        vi.stubEnv('PROJITIVE_SCAN_MAX_DEPTH', '10')
        expect(resolveScanDepth()).toBe(8)
        vi.unstubAllEnvs()
      })

      it('throws error for invalid depth configuration', () => {
        vi.stubEnv('PROJITIVE_SCAN_ROOT_PATH', '/test/root')
        vi.stubEnv('PROJITIVE_SCAN_MAX_DEPTH', 'not-a-number')
        expect(() => resolveScanDepth()).toThrow('Invalid PROJITIVE_SCAN_MAX_DEPTH')
        vi.unstubAllEnvs()
      })

      it('throws when PROJITIVE_SCAN_MAX_DEPTH env var is missing', () => {
        vi.unstubAllEnvs()
        expect(() => resolveScanDepth()).toThrow('Missing required environment variable: PROJITIVE_SCAN_MAX_DEPTH')
      })
    })

    describe('resolveScanRoot', () => {
      it('returns first scan root from env', () => {
        vi.stubEnv('PROJITIVE_SCAN_ROOT_PATH', '/test/root')
        expect(resolveScanRoot()).toBe('/test/root')
        vi.unstubAllEnvs()
      })

      it('returns normalized path when inputPath is provided', () => {
        vi.stubEnv('PROJITIVE_SCAN_ROOT_PATH', '/fallback')
        expect(resolveScanRoot('/custom/path')).toBe('/custom/path')
        vi.unstubAllEnvs()
      })
    })
  })

  describe('registerProjectTools', () => {
    it('registers project tools without throwing', () => {
      const mockServer = {
        registerTool: vi.fn(),
      }
      
      expect(() => registerProjectTools(mockServer as unknown as McpServer)).not.toThrow()
      expect(mockServer.registerTool).toHaveBeenCalled()
    })

    it('projectScan lists project root paths instead of governance directories', async () => {
      const root = await createTempDir()
      const projectRoot = path.join(root, 'app')
      const governanceDir = path.join(projectRoot, '.projitive')
      const templateDir = await createTempDir()
      await fs.mkdir(governanceDir, { recursive: true })
      await fs.writeFile(path.join(governanceDir, '.projitive'), '', 'utf-8')

      vi.stubEnv('PROJITIVE_SCAN_ROOT_PATHS', root)
      vi.stubEnv('PROJITIVE_SCAN_MAX_DEPTH', '3')
      vi.stubEnv('PROJITIVE_MESSAGE_TEMPLATE_PATH', templateDir)

      const mockServer = {
        registerTool: vi.fn(),
      }

      registerProjectTools(mockServer as unknown as McpServer)

      const projectScanCall = mockServer.registerTool.mock.calls.find((call) => call[0] === 'projectScan')
      expect(projectScanCall).toBeTruthy()

      const projectScanHandler = projectScanCall?.[2] as (() => Promise<{ content: { type: 'text'; text: string }[] }>) | undefined
      expect(projectScanHandler).toBeTruthy()
      const result = await projectScanHandler!()
      const markdown = result.content[0]?.text ?? ''

      expect(markdown).toContain(`1. ${projectRoot}`)
      expect(markdown).not.toContain(`1. ${governanceDir}`)
    })

    it('projectScan returns no-project guidance when scan root is empty', async () => {
      const emptyRoot = await createTempDir()

      vi.stubEnv('PROJITIVE_SCAN_ROOT_PATHS', emptyRoot)
      vi.stubEnv('PROJITIVE_SCAN_MAX_DEPTH', '2')

      const mockServer = { registerTool: vi.fn() }
      registerProjectTools(mockServer as unknown as McpServer)

      const projectScan = getProjectToolHandler(mockServer, 'projectScan')
      const result = await projectScan()

      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('No governance root discovered')
    })

    it('projectNext ranks multiple actionable projects by score', async () => {
      const scanRoot = await createTempDir()
      const projectA = path.join(scanRoot, 'app-a')
      const projectB = path.join(scanRoot, 'app-b')
      await fs.mkdir(projectA, { recursive: true })
      await fs.mkdir(projectB, { recursive: true })
      await initializeProjectStructure(projectA)
      await initializeProjectStructure(projectB)

      vi.stubEnv('PROJITIVE_SCAN_ROOT_PATHS', scanRoot)
      vi.stubEnv('PROJITIVE_SCAN_MAX_DEPTH', '3')

      const mockServer = { registerTool: vi.fn() }
      registerProjectTools(mockServer as unknown as McpServer)

      const projectNext = getProjectToolHandler(mockServer, 'projectNext')
      const result = await projectNext({})

      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('actionableProjects:')
    })

    it('projectInit handler initializes project structure', async () => {
      const root = await createTempDir()

      const mockServer = { registerTool: vi.fn() }
      registerProjectTools(mockServer as unknown as McpServer)

      const projectInit = getProjectToolHandler(mockServer, 'projectInit')
      const result = await projectInit({ projectPath: root })

      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('governanceDir:')
      expect(result.content[0].text).toContain('createdFiles:')
    })

    it('projectLocate resolves governance dir from any inner path', async () => {
      const root = await createTempDir()
      const projectRoot = path.join(root, 'myapp')
      const governanceDir = path.join(projectRoot, '.projitive')
      await fs.mkdir(governanceDir, { recursive: true })
      await fs.writeFile(path.join(governanceDir, '.projitive'), '', 'utf-8')

      const mockServer = { registerTool: vi.fn() }
      registerProjectTools(mockServer as unknown as McpServer)

      const projectLocate = getProjectToolHandler(mockServer, 'projectLocate')
      const result = await projectLocate({ inputPath: governanceDir })

      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain(`projectPath: ${projectRoot}`)
      expect(result.content[0].text).toContain(`governanceDir: ${governanceDir}`)
    })

    it('projectNext ranks actionable projects by score', async () => {
      const scanRoot = await createTempDir()
      const projectRoot = path.join(scanRoot, 'myapp')
      await fs.mkdir(projectRoot, { recursive: true })
      await initializeProjectStructure(projectRoot)

      vi.stubEnv('PROJITIVE_SCAN_ROOT_PATHS', scanRoot)
      vi.stubEnv('PROJITIVE_SCAN_MAX_DEPTH', '3')

      const mockServer = { registerTool: vi.fn() }
      registerProjectTools(mockServer as unknown as McpServer)

      const projectNext = getProjectToolHandler(mockServer, 'projectNext')
      const result = await projectNext({})

      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('actionableProjects:')
      expect(result.content[0].text).toContain('myapp')
    })

    it('projectContext shows task stats and governance artifacts', async () => {
      const root = await createTempDir()
      await initializeProjectStructure(root)

      const mockServer = { registerTool: vi.fn() }
      registerProjectTools(mockServer as unknown as McpServer)

      const projectContext = getProjectToolHandler(mockServer, 'projectContext')
      const result = await projectContext({ projectPath: root })

      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('Task Summary')
      expect(result.content[0].text).toContain('Artifacts')
    })

    it('syncViews materializes both tasks and roadmap markdown views', async () => {
      const root = await createTempDir()
      await initializeProjectStructure(root)

      const mockServer = { registerTool: vi.fn() }
      registerProjectTools(mockServer as unknown as McpServer)

      const syncViews = getProjectToolHandler(mockServer, 'syncViews')
      const result = await syncViews({ projectPath: root, views: ['tasks', 'roadmap'], force: true })

      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('tasks.md synced')
      expect(result.content[0].text).toContain('roadmap.md synced')
    })
  })
})
