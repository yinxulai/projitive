// Common utility functions

import fs from "node:fs/promises"
import path from "node:path"
import { FileNotFoundError, FileReadError } from "./errors.js"

/**
 * Safely read Markdown file content, return fallback if file doesn't exist or is empty
 */
export async function readMarkdownOrFallback(
  relativePath: string,
  fallbackTitle: string,
  repoRoot: string = process.cwd()
): Promise<string> {
  const absolutePath = path.resolve(repoRoot, relativePath)

  try {
    const content = await fs.readFile(absolutePath, "utf-8")
    if (content.trim().length > 0) {
      return content
    }
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      console.error(`Failed to read file: ${absolutePath}`, error)
    }
  }

  return [
    `# ${fallbackTitle}`,
    "",
    `- file: ${relativePath}`,
    "- status: missing-or-empty",
    "- next: create this file or ensure it has readable markdown content",
  ].join("\n")
}

/**
 * Capitalize first letter
 */
export function capitalizeFirstLetter(str: string): string {
  return str.split(/[-_]/).map(part =>
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join('')
}

/**
 * Format title
 */
export function formatTitle(str: string): string {
  return str.split(/[-_]/).map(part =>
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join(' ')
}
