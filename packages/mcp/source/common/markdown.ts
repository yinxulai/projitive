import fs from "node:fs/promises";

export type MarkdownSection = {
  heading: string;
  level: number;
  startLine: number;
  endLine: number;
};

export async function readMarkdownSections(filePath: string): Promise<{ filePath: string; lineCount: number; sections: MarkdownSection[] }> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const headers: Array<{ heading: string; level: number; startLine: number }> = [];

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headers.push({ level: match[1].length, heading: match[2].trim(), startLine: index + 1 });
    }
  });

  const sections: MarkdownSection[] = headers.map((header, index) => {
    const next = headers[index + 1];
    return {
      heading: header.heading,
      level: header.level,
      startLine: header.startLine,
      endLine: next ? next.startLine - 1 : lines.length,
    };
  });

  return { filePath, lineCount: lines.length, sections };
}

export async function findTextReferences(filePath: string, needle: string): Promise<Array<{ filePath: string; line: number; text: string }>> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const result: Array<{ filePath: string; line: number; text: string }> = [];

  lines.forEach((line, index) => {
    if (line.includes(needle)) {
      result.push({ filePath, line: index + 1, text: line.trim() });
    }
  });

  return result;
}
