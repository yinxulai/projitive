export function asText(markdown: string) {
  return {
    content: [{ type: "text" as const, text: markdown }],
  };
}

function withFallback(lines: string[]): string[] {
  return lines.length > 0 ? lines : ["- (none)"];
}

function shouldKeepRawLine(trimmed: string): boolean {
  if (trimmed.length === 0) {
    return true;
  }

  if (trimmed.startsWith("#") || trimmed.startsWith(">") || trimmed.startsWith("```")) {
    return true;
  }

  if (/^[-*+]\s/.test(trimmed)) {
    return true;
  }

  if (/^\d+\.\s/.test(trimmed)) {
    return true;
  }

  return false;
}

function normalizeLine(line: string): string {
  const trimmed = line.trim();
  if (shouldKeepRawLine(trimmed)) {
    return line;
  }
  return `- ${trimmed}`;
}

function normalizeLines(lines: string[]): string[] {
  return lines.map((line) => normalizeLine(line));
}

export type ToolSectionTitle = "Summary" | "Evidence" | "Agent Guidance" | "Lint Suggestions" | "Next Call" | "Error" | "Next Step" | "Retry Example";

export type ToolResponseSection = {
  title: ToolSectionTitle | string;
  lines: string[];
};

export type ToolResponsePayload = {
  toolName: string;
  sections: ToolResponseSection[];
};

export function section(title: ToolSectionTitle | string, lines: string[]): ToolResponseSection {
  return { title, lines: normalizeLines(lines) };
}

export function summarySection(lines: string[]): ToolResponseSection {
  return section("Summary", lines);
}

export function evidenceSection(lines: string[]): ToolResponseSection {
  return section("Evidence", lines);
}

export function guidanceSection(lines: string[]): ToolResponseSection {
  return section("Agent Guidance", lines);
}

export function lintSection(lines: string[]): ToolResponseSection {
  return section("Lint Suggestions", lines);
}

export function nextCallSection(nextCall?: string): ToolResponseSection {
  return section("Next Call", nextCall ? [nextCall] : []);
}

export function renderToolResponseMarkdown(payload: ToolResponsePayload): string {
  const body = payload.sections.flatMap((section) => [
    `## ${section.title}`,
    ...withFallback(section.lines),
    "",
  ]);

  return [
    `# ${payload.toolName}`,
    "",
    ...body,
  ].join("\n").trimEnd();
}

export function renderErrorMarkdown(toolName: string, cause: string, nextSteps: string[], retryExample?: string): string {
  return renderToolResponseMarkdown({
    toolName,
    sections: [
      section("Error", [`cause: ${cause}`]),
      section("Next Step", nextSteps),
      section("Retry Example", [retryExample ?? "(none)"]),
    ],
  });
}
