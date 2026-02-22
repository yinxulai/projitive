// 设计文件资源管理

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { readMarkdownOrFallback, formatTitle, capitalizeFirstLetter } from "../common/utils.js"

export function registerDesignFilesResources(server: McpServer, repoRoot: string): void {
  // 注册项目根目录下 design/ 文件夹的设计规范文件
  const designFiles = [
    "PROJITIVE.md",
    "PROJITIVE_CN.md",
    "DESIGNS.md",
    "DESIGNS_CN.md",
    "TASKS.md",
    "TASKS_CN.md",
    "ROADMAP.md",
    "ROADMAP_CN.md",
    "REPORTS.md",
    "REPORTS_CN.md",
    "HOOKS.md",
    "HOOKS_CN.md",
    "README.md",
    "README_CN.md"
  ]

  designFiles.forEach((fileName) => {
    const designId = fileName.toLowerCase().replace('.md', '')
    const resourceName = `design${capitalizeFirstLetter(designId)}`
    const uri = `projitive://designs/${designId}`

    server.registerResource(
      resourceName,
      uri,
      {
        title: formatTitle(designId),
        description: `Design specification: ${fileName}`,
        mimeType: "text/markdown",
      },
      async () => ({
        contents: [
          {
            uri,
            text: await readMarkdownOrFallback(`design/${fileName}`, formatTitle(designId), repoRoot),
          },
        ],
      })
    )
  })
}
