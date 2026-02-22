# Benchmark Suite

性能基准测试套件，用于测量 MCP 服务器的性能表现。

## 运行基准测试

```bash
# 运行所有基准测试
npm run benchmark

# 或者使用 npx
npx vitest bench --run
```

## 基准测试文件

| 文件 | 描述 |
|------|------|
| `tasks.bench.ts` | 任务相关操作的基准测试（渲染、解析） |
| `markdown.bench.ts` | Markdown 处理的基准测试 |
| `projitive.bench.ts` | 项目发现和定位的基准测试 |
| `validation.bench.ts` | 验证和置信度计算的基准测试 |

## 性能指标

基准测试测量以下操作的性能：

- **任务渲染**: `renderTasksMarkdown` - 小/大任务列表
- **任务解析**: `parseTasksMarkdown` - 小/大文档
- **Markdown 处理**: 各种 Markdown 操作
- **项目发现**: 项目定位和扫描
- **置信度计算**: 验证和评分算法

## CI/CD 集成

基准测试已集成到 GitHub Actions 工作流中：

- 每次 PR 和 push 都会运行基准测试
- 性能回归会被检测并报告
- 历史基准数据用于比较

## 添加新的基准测试

1. 在 `source/benchmark/` 目录创建新的 `.bench.ts` 文件
2. 使用 `vitest` 的 `describe` 和 `bench` API
3. 运行 `npm run benchmark` 验证
