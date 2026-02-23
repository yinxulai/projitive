// 公共工具函数

import fs from "node:fs/promises"
import path from "node:path"
import { FileNotFoundError, FileReadError } from "./errors.js"

/**
 * 安全地读取 Markdown 文件内容，如果文件不存在或为空则返回 fallback
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
 * 首字母大写
 */
export function capitalizeFirstLetter(str: string): string {
  return str.split(/[-_]/).map(part =>
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join('')
}

/**
 * 格式化标题
 */
export function formatTitle(str: string): string {
  return str.split(/[-_]/).map(part =>
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join(' ')
}
