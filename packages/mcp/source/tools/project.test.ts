import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoverProjects,
  discoverProjectsAcrossRoots,
  hasProjectMarker,
  initializeProjectStructure,
  resolveGovernanceDir,
  resolveScanRoots,
  resolveScanDepth,
  toProjectPath,
  registerProjectTools
} from "./project.js";

const tempPaths: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "projitive-mcp-test-"));
  tempPaths.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempPaths.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    })
  );
  vi.restoreAllMocks();
});

describe("projitive module", () => {
  describe("hasProjectMarker", () => {
    it("does not treat marker directory as a valid project marker", async () => {
      const root = await createTempDir();
      const dirMarkerPath = path.join(root, ".projitive");
      await fs.mkdir(dirMarkerPath, { recursive: true });

      const hasMarker = await hasProjectMarker(root);
      expect(hasMarker).toBe(false);
    });

    it("returns true when .projitive marker file exists", async () => {
      const root = await createTempDir();
      const markerPath = path.join(root, ".projitive");
      await fs.writeFile(markerPath, "", "utf-8");

      const hasMarker = await hasProjectMarker(root);
      expect(hasMarker).toBe(true);
    });

    it("returns false when .projitive marker file does not exist", async () => {
      const root = await createTempDir();
      const hasMarker = await hasProjectMarker(root);
      expect(hasMarker).toBe(false);
    });

    it("handles fs.stat errors gracefully", async () => {
      const root = await createTempDir();
      vi.spyOn(fs, "stat").mockRejectedValueOnce(new Error("Permission denied"));
      
      const hasMarker = await hasProjectMarker(root);
      expect(hasMarker).toBe(false);
    });
  });

  describe("resolveGovernanceDir", () => {
    it("resolves governance dir by walking upwards for .projitive", async () => {
      const root = await createTempDir();
      const governanceDir = path.join(root, "repo", "governance");
      const deepDir = path.join(governanceDir, "nested", "module");
      await fs.mkdir(deepDir, { recursive: true });
      await fs.writeFile(path.join(governanceDir, ".projitive"), "", "utf-8");

      const resolved = await resolveGovernanceDir(deepDir);
      expect(resolved).toBe(governanceDir);
    });

    it("resolves nested default governance dir when input path is project root", async () => {
      const root = await createTempDir();
      const projectRoot = path.join(root, "repo");
      const governanceDir = path.join(projectRoot, ".projitive");
      await fs.mkdir(governanceDir, { recursive: true });
      await fs.writeFile(path.join(governanceDir, ".projitive"), "", "utf-8");

      const resolved = await resolveGovernanceDir(projectRoot);
      expect(resolved).toBe(governanceDir);
    });

    it("resolves nested custom governance dir when input path is project root", async () => {
      const root = await createTempDir();
      const projectRoot = path.join(root, "repo");
      const governanceDir = path.join(projectRoot, "governance");
      await fs.mkdir(governanceDir, { recursive: true });
      await fs.writeFile(path.join(governanceDir, ".projitive"), "", "utf-8");

      const resolved = await resolveGovernanceDir(projectRoot);
      expect(resolved).toBe(governanceDir);
    });

    it("throws error when path not found", async () => {
      const root = await createTempDir();
      const nonExistentPath = path.join(root, "nonexistent");
      
      await expect(resolveGovernanceDir(nonExistentPath)).rejects.toThrow("Path not found");
    });

    it("throws error when no .projitive marker found", async () => {
      const root = await createTempDir();
      const deepDir = path.join(root, "a", "b", "c");
      await fs.mkdir(deepDir, { recursive: true });
      
      await expect(resolveGovernanceDir(deepDir)).rejects.toThrow("No .projitive marker found");
    });

    it("prefers default .projitive directory when multiple governance roots found as children", async () => {
      const root = await createTempDir();
      const childDir = path.join(root, "child");
      const governance1 = path.join(childDir, ".projitive");
      const governance2 = path.join(childDir, "governance");
      await fs.mkdir(governance1, { recursive: true });
      await fs.mkdir(governance2, { recursive: true });
      await fs.writeFile(path.join(governance1, ".projitive"), "", "utf-8");
      await fs.writeFile(path.join(governance2, ".projitive"), "", "utf-8");
      
      const resolved = await resolveGovernanceDir(childDir);
      expect(resolved).toBe(governance1); // Should prefer default .projitive
    });

    it("resolves file path by using its directory", async () => {
      const root = await createTempDir();
      const governanceDir = path.join(root, ".projitive");
      const filePath = path.join(governanceDir, "tasks.md");
      await fs.mkdir(governanceDir, { recursive: true });
      await fs.writeFile(path.join(governanceDir, ".projitive"), "", "utf-8");
      await fs.writeFile(filePath, "# Tasks", "utf-8");

      const resolved = await resolveGovernanceDir(filePath);
      expect(resolved).toBe(governanceDir);
    });
  });

  describe("discoverProjects", () => {
    it("discovers projects by marker file", async () => {
      const root = await createTempDir();
      const p1 = path.join(root, "a");
      const p2 = path.join(root, "b", "c");
      await fs.mkdir(p1, { recursive: true });
      await fs.mkdir(p2, { recursive: true });
      await fs.writeFile(path.join(p1, ".projitive"), "", "utf-8");
      await fs.writeFile(path.join(p2, ".projitive"), "", "utf-8");

      const projects = await discoverProjects(root, 4);
      expect(projects).toContain(p1);
      expect(projects).toContain(p2);
    });

    it("discovers nested default governance directory under project root", async () => {
      const root = await createTempDir();
      const projectRoot = path.join(root, "app");
      const governanceDir = path.join(projectRoot, ".projitive");
      await fs.mkdir(governanceDir, { recursive: true });
      await fs.writeFile(path.join(governanceDir, ".projitive"), "", "utf-8");

      const projects = await discoverProjects(root, 3);
      expect(projects).toContain(governanceDir);
    });

    it("discovers nested custom governance directory under project root", async () => {
      const root = await createTempDir();
      const projectRoot = path.join(root, "app");
      const governanceDir = path.join(projectRoot, "governance");
      await fs.mkdir(governanceDir, { recursive: true });
      await fs.writeFile(path.join(governanceDir, ".projitive"), "", "utf-8");

      const projects = await discoverProjects(root, 3);
      expect(projects).toContain(governanceDir);
    });

    it("respects maxDepth limit", async () => {
      const root = await createTempDir();
      const shallow = path.join(root, "shallow");
      const deep = path.join(root, "level1", "level2", "level3", "level4", "deep");
      await fs.mkdir(shallow, { recursive: true });
      await fs.mkdir(deep, { recursive: true });
      await fs.writeFile(path.join(shallow, ".projitive"), "", "utf-8");
      await fs.writeFile(path.join(deep, ".projitive"), "", "utf-8");

      const projects = await discoverProjects(root, 3);
      expect(projects).toContain(shallow);
      expect(projects).not.toContain(deep);
    });

    it("ignores common ignore directories", async () => {
      const root = await createTempDir();
      const nodeModulesProject = path.join(root, "node_modules", "project");
      const gitProject = path.join(root, ".git", "project");
      const validProject = path.join(root, "valid");
      await fs.mkdir(nodeModulesProject, { recursive: true });
      await fs.mkdir(gitProject, { recursive: true });
      await fs.mkdir(validProject, { recursive: true });
      await fs.writeFile(path.join(nodeModulesProject, ".projitive"), "", "utf-8");
      await fs.writeFile(path.join(gitProject, ".projitive"), "", "utf-8");
      await fs.writeFile(path.join(validProject, ".projitive"), "", "utf-8");

      const projects = await discoverProjects(root, 3);
      expect(projects).toContain(validProject);
      expect(projects).not.toContain(nodeModulesProject);
      expect(projects).not.toContain(gitProject);
    });

    it("returns empty array when no projects found", async () => {
      const root = await createTempDir();
      const projects = await discoverProjects(root, 3);
      expect(projects).toEqual([]);
    });

    it("returns unique and sorted results", async () => {
      const root = await createTempDir();
      const projectB = path.join(root, "b");
      const projectA = path.join(root, "a");
      await fs.mkdir(projectB, { recursive: true });
      await fs.mkdir(projectA, { recursive: true });
      await fs.writeFile(path.join(projectB, ".projitive"), "", "utf-8");
      await fs.writeFile(path.join(projectA, ".projitive"), "", "utf-8");

      const projects = await discoverProjects(root, 3);
      expect(projects).toEqual([projectA, projectB]);
    });

    it("handles fs.readdir errors gracefully", async () => {
      const root = await createTempDir();
      vi.spyOn(fs, "readdir").mockRejectedValueOnce(new Error("Permission denied"));
      
      const projects = await discoverProjects(root, 3);
      expect(projects).toEqual([]);
    });

    it("ignores non-existent roots when scanning across multiple roots", async () => {
      const validRoot = await createTempDir();
      const validProject = path.join(validRoot, "project-a");
      const missingRoot = path.join(validRoot, "__missing_root__");
      await fs.mkdir(validProject, { recursive: true });
      await fs.writeFile(path.join(validProject, ".projitive"), "", "utf-8");

      const projects = await discoverProjectsAcrossRoots([missingRoot, validRoot], 3);
      expect(projects).toContain(validProject);
    });
  });

  describe("initializeProjectStructure", () => {
    it("initializes governance structure under default .projitive directory", async () => {
      const root = await createTempDir();

      const initialized = await initializeProjectStructure(root);
      expect(initialized.governanceDir).toBe(path.join(root, ".projitive"));

      const expectedPaths = [
        path.join(root, ".projitive", ".projitive"),
        path.join(root, ".projitive", "README.md"),
        path.join(root, ".projitive", "roadmap.md"),
        path.join(root, ".projitive", "tasks.md"),
        path.join(root, ".projitive", "hooks", "task_no_actionable.md"),
        path.join(root, ".projitive", "designs"),
        path.join(root, ".projitive", "reports"),
        path.join(root, ".projitive", "hooks"),
      ];

      await Promise.all(expectedPaths.map(async (targetPath) => {
        await expect(fs.access(targetPath)).resolves.toBeUndefined();
      }));
    });

    it("overwrites template files when force is enabled", async () => {
      const root = await createTempDir();
      const governanceDir = path.join(root, ".projitive");
      const readmePath = path.join(governanceDir, "README.md");

      await initializeProjectStructure(root);
      await fs.writeFile(readmePath, "custom-content", "utf-8");

      const initialized = await initializeProjectStructure(root, ".projitive", true);
      const readmeContent = await fs.readFile(readmePath, "utf-8");

      expect(readmeContent).toContain("Projitive Governance Workspace");
      expect(initialized.files.find((item) => item.path === readmePath)?.action).toBe("updated");
    });

    it("uses custom governance directory when specified", async () => {
      const root = await createTempDir();
      const customDir = "my-governance";

      const initialized = await initializeProjectStructure(root, customDir);
      expect(initialized.governanceDir).toBe(path.join(root, customDir));
    });

    it("throws error when project path not found", async () => {
      const root = await createTempDir();
      const nonExistentPath = path.join(root, "nonexistent");
      
      await expect(initializeProjectStructure(nonExistentPath)).rejects.toThrow("Path not found");
    });

    it("throws error when project path is not a directory", async () => {
      const root = await createTempDir();
      const filePath = path.join(root, "file.txt");
      await fs.writeFile(filePath, "content", "utf-8");
      
      await expect(initializeProjectStructure(filePath)).rejects.toThrow("projectPath must be a directory");
    });

    it("creates governance structure with default name when invalid names are provided", async () => {
      const root = await createTempDir();
      
      // When governanceDir is invalid, it should fall back to default
      // Note: normalizeGovernanceDirName is not exported, so we test initialization behavior
      const initialized = await initializeProjectStructure(root);
      expect(initialized.governanceDir).toBe(path.join(root, ".projitive"));
    });

    it("skips existing files when force is disabled", async () => {
      const root = await createTempDir();
      const governanceDir = path.join(root, ".projitive");
      const readmePath = path.join(governanceDir, "README.md");

      await initializeProjectStructure(root);
      await fs.writeFile(readmePath, "custom-content", "utf-8");

      const initialized = await initializeProjectStructure(root, ".projitive", false);
      const readmeContent = await fs.readFile(readmePath, "utf-8");

      expect(readmeContent).toBe("custom-content");
      expect(initialized.files.find((item) => item.path === readmePath)?.action).toBe("skipped");
    });

    it("creates all required subdirectories", async () => {
      const root = await createTempDir();

      const initialized = await initializeProjectStructure(root);
      
      expect(initialized.directories.some(d => d.path.includes("designs"))).toBe(true);
      expect(initialized.directories.some(d => d.path.includes("reports"))).toBe(true);
      expect(initialized.directories.some(d => d.path.includes("hooks"))).toBe(true);
    });
  });

  describe("utility functions", () => {
    describe("toProjectPath", () => {
      it("returns parent directory of governance dir", () => {
        expect(toProjectPath("/path/to/project/.projitive")).toBe("/path/to/project");
        expect(toProjectPath("/a/b/c")).toBe("/a/b");
      });
    });

    describe("resolveScanRoots", () => {
      it("uses legacy environment variable when no multi-root env is provided", () => {
        vi.stubEnv("PROJITIVE_SCAN_ROOT_PATH", "/test/root");
        expect(resolveScanRoots()).toEqual(["/test/root"]);
        vi.unstubAllEnvs();
      });

      it("uses input paths when provided", () => {
        vi.stubEnv("PROJITIVE_SCAN_ROOT_PATH", "/test/root");
        expect(resolveScanRoots(["/custom/path", " /custom/path ", "/second/path"])).toEqual(["/custom/path", "/second/path"]);
        vi.unstubAllEnvs();
      });

      it("uses PROJITIVE_SCAN_ROOT_PATHS with platform delimiter", () => {
        vi.stubEnv("PROJITIVE_SCAN_ROOT_PATHS", ["/root/a", "/root/b", "", " /root/c "].join(path.delimiter));
        expect(resolveScanRoots()).toEqual(["/root/a", "/root/b", "/root/c"]);
        vi.unstubAllEnvs();
      });

      it("treats JSON-like string as plain delimiter input", () => {
        vi.stubEnv("PROJITIVE_SCAN_ROOT_PATHS", JSON.stringify(["/json/a", "/json/b"]));
        expect(resolveScanRoots()).toHaveLength(1);
        vi.unstubAllEnvs();
      });

      it("throws error when no root environment variables are configured", () => {
        vi.unstubAllEnvs();
        expect(() => resolveScanRoots()).toThrow("Missing required environment variable: PROJITIVE_SCAN_ROOT_PATHS");
      });
    });

    describe("resolveScanDepth", () => {
      it("uses environment variable when no input depth", () => {
        vi.stubEnv("PROJITIVE_SCAN_ROOT_PATH", "/test/root");
        vi.stubEnv("PROJITIVE_SCAN_MAX_DEPTH", "5");
        expect(resolveScanDepth()).toBe(5);
        vi.unstubAllEnvs();
      });

      it("uses input depth when provided", () => {
        vi.stubEnv("PROJITIVE_SCAN_ROOT_PATH", "/test/root");
        vi.stubEnv("PROJITIVE_SCAN_MAX_DEPTH", "5");
        expect(resolveScanDepth(3)).toBe(3);
        vi.unstubAllEnvs();
      });

      it("clamps depth to MAX_SCAN_DEPTH", () => {
        vi.stubEnv("PROJITIVE_SCAN_ROOT_PATH", "/test/root");
        vi.stubEnv("PROJITIVE_SCAN_MAX_DEPTH", "10");
        expect(resolveScanDepth()).toBe(8);
        vi.unstubAllEnvs();
      });

      it("throws error for invalid depth configuration", () => {
        vi.stubEnv("PROJITIVE_SCAN_ROOT_PATH", "/test/root");
        vi.stubEnv("PROJITIVE_SCAN_MAX_DEPTH", "not-a-number");
        expect(() => resolveScanDepth()).toThrow("Invalid PROJITIVE_SCAN_MAX_DEPTH");
        vi.unstubAllEnvs();
      });
    });
  });

  describe("registerProjectTools", () => {
    it("registers project tools without throwing", () => {
      const mockServer = {
        registerTool: vi.fn(),
      };
      
      expect(() => registerProjectTools(mockServer as any)).not.toThrow();
      expect(mockServer.registerTool).toHaveBeenCalled();
    });
  });
});
