import { describe, expect, it } from "vitest";
import {
  registerDesignContextResources,
  registerDesignContextPrompts,
} from "./design-context.js";

// Mock McpServer
class MockMcpServer {
  resources: any[] = [];
  prompts: any[] = [];

  registerResource(name: string, uri: string, metadata: any, handler: any) {
    this.resources.push({ name, uri, metadata, handler });
  }

  registerPrompt(name: string, metadata: any, handler: any) {
    this.prompts.push({ name, metadata, handler });
  }
}

describe("design-context module", () => {
  describe("registerDesignContextResources", () => {
    it("registers design quick start resource", () => {
      const server = new MockMcpServer();
      registerDesignContextResources(server as any);

      const quickStartResource = server.resources.find(
        (r) => r.name === "designQuickStart"
      );
      expect(quickStartResource).toBeDefined();
      expect(quickStartResource?.uri).toBe("projitive://design/quick-start");
      expect(quickStartResource?.metadata.mimeType).toBe("text/markdown");
    });

    it("registers design principles resource", () => {
      const server = new MockMcpServer();
      registerDesignContextResources(server as any);

      const principlesResource = server.resources.find(
        (r) => r.name === "designPrinciples"
      );
      expect(principlesResource).toBeDefined();
      expect(principlesResource?.uri).toBe("projitive://design/principles");
    });

    it("registers execution rules resource", () => {
      const server = new MockMcpServer();
      registerDesignContextResources(server as any);

      const rulesResource = server.resources.find(
        (r) => r.name === "executionRules"
      );
      expect(rulesResource).toBeDefined();
      expect(rulesResource?.uri).toBe("projitive://design/execution-rules");
    });

    it("registers all three resources", () => {
      const server = new MockMcpServer();
      registerDesignContextResources(server as any);

      expect(server.resources.length).toBe(3);
    });

    it("resource handlers return valid content", async () => {
      const server = new MockMcpServer();
      registerDesignContextResources(server as any);

      for (const resource of server.resources) {
        const result = await resource.handler();
        expect(result.contents).toBeDefined();
        expect(result.contents.length).toBeGreaterThan(0);
        expect(result.contents[0].uri).toBeDefined();
        expect(result.contents[0].text).toBeDefined();
        expect(typeof result.contents[0].text).toBe("string");
        expect(result.contents[0].text.length).toBeGreaterThan(0);
      }
    });

    it("design quick start contains core sections", async () => {
      const server = new MockMcpServer();
      registerDesignContextResources(server as any);

      const quickStartResource = server.resources.find(
        (r) => r.name === "designQuickStart"
      );
      const result = await quickStartResource!.handler();
      const content = result.contents[0].text;

      expect(content).toContain("Projitive Design Quick Start");
      expect(content).toContain("What is Projitive?");
      expect(content).toContain("Core Design Goals");
      expect(content).toContain("Execution Constraints");
      expect(content).toContain("Agent Execution Loop");
    });

    it("design principles contains core principles", async () => {
      const server = new MockMcpServer();
      registerDesignContextResources(server as any);

      const principlesResource = server.resources.find(
        (r) => r.name === "designPrinciples"
      );
      const result = await principlesResource!.handler();
      const content = result.contents[0].text;

      expect(content).toContain("Projitive Design Principles");
      expect(content).toContain("Agent-First Design");
      expect(content).toContain("Markdown-First Artifacts");
      expect(content).toContain("Evidence-First Transitions");
      expect(content).toContain("Immutable IDs");
      expect(content).toContain("Discoverable Execution");
    });

    it("execution rules contains hard rules", async () => {
      const server = new MockMcpServer();
      registerDesignContextResources(server as any);

      const rulesResource = server.resources.find(
        (r) => r.name === "executionRules"
      );
      const result = await rulesResource!.handler();
      const content = result.contents[0].text;

      expect(content).toContain("Projitive Execution Rules");
      expect(content).toContain("Hard Rules");
      expect(content).toContain("ID Immutability");
      expect(content).toContain("Evidence Required");
      expect(content).toContain("Markdown Governance Only");
      expect(content).toContain("Status Machine");
    });
  });

  describe("registerDesignContextPrompts", () => {
    it("registers understandDesignContext prompt", () => {
      const server = new MockMcpServer();
      registerDesignContextPrompts(server as any);

      const prompt = server.prompts.find(
        (p) => p.name === "understandDesignContext"
      );
      expect(prompt).toBeDefined();
      expect(prompt?.metadata.title).toBe("Understand Design Context");
    });

    it("registers fastStartExecution prompt", () => {
      const server = new MockMcpServer();
      registerDesignContextPrompts(server as any);

      const prompt = server.prompts.find(
        (p) => p.name === "fastStartExecution"
      );
      expect(prompt).toBeDefined();
      expect(prompt?.metadata.title).toBe("Fast Start Execution");
    });

    it("registers both prompts", () => {
      const server = new MockMcpServer();
      registerDesignContextPrompts(server as any);

      expect(server.prompts.length).toBe(2);
    });

    it("prompt handlers return valid messages", async () => {
      const server = new MockMcpServer();
      registerDesignContextPrompts(server as any);

      for (const prompt of server.prompts) {
        const result = await prompt.handler({});
        expect(result.messages).toBeDefined();
        expect(result.messages.length).toBeGreaterThan(0);
        expect(result.messages[0].role).toBe("user");
        expect(result.messages[0].content.type).toBe("text");
        expect(typeof result.messages[0].content.text).toBe("string");
        expect(result.messages[0].content.text.length).toBeGreaterThan(0);
      }
    });

    it("understandDesignContext prompt contains guidance", async () => {
      const server = new MockMcpServer();
      registerDesignContextPrompts(server as any);

      const prompt = server.prompts.find(
        (p) => p.name === "understandDesignContext"
      );
      const result = await prompt!.handler({});
      const content = result.messages[0].content.text;

      expect(content).toContain("Load Projitive design context");
      expect(content).toContain("projitive://design/quick-start");
      expect(content).toContain("projitive://design/principles");
      expect(content).toContain("projitive://design/execution-rules");
    });

    it("fastStartExecution prompt contains execution steps", async () => {
      const server = new MockMcpServer();
      registerDesignContextPrompts(server as any);

      const prompt = server.prompts.find(
        (p) => p.name === "fastStartExecution"
      );
      const result = await prompt!.handler({});
      const content = result.messages[0].content.text;

      expect(content).toContain("Execute Projitive task");
      expect(content).toContain("STEP 1: Get task");
      expect(content).toContain("STEP 2: Load context");
      expect(content).toContain("STEP 3: Execute task");
      expect(content).toContain("STEP 4: Verify");
      expect(content).toContain("taskNext");
      expect(content).toContain("taskContext");
    });
  });

  describe("integration", () => {
    it("can register both resources and prompts", () => {
      const server = new MockMcpServer();
      registerDesignContextResources(server as any);
      registerDesignContextPrompts(server as any);

      expect(server.resources.length).toBe(3);
      expect(server.prompts.length).toBe(2);
    });

    it("all resources and prompts have unique names", () => {
      const server = new MockMcpServer();
      registerDesignContextResources(server as any);
      registerDesignContextPrompts(server as any);

      const resourceNames = server.resources.map((r) => r.name);
      const promptNames = server.prompts.map((p) => p.name);
      const allNames = [...resourceNames, ...promptNames];
      const uniqueNames = new Set(allNames);

      expect(allNames.length).toBe(uniqueNames.size);
    });
  });
});
