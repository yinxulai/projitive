# Simple Demo Project

这是一个简单的 Projitive 演示项目，展示了基本的 AI 驱动开发治理流程。

## 项目概述

这个项目演示了如何使用 Projitive 来管理 AI 驱动的开发工作流。它包含了完整的治理结构和示例任务。

## 项目结构

```
simple-demo/
├── .projitive/              # Projitive 治理目录
│   ├── .projitive           # 治理标记文件
│   ├── README.md            # 治理说明
│   ├── roadmap.md           # 项目路线图
│   ├── tasks.md             # 任务管理
│   ├── designs/             # 设计文档
│   ├── reports/             # 执行报告
│   └── hooks/               # AI 指导提示
├── src/                     # 源代码（示例）
└── README.md                # 本文件
```

## 快速开始

### 1. 初始化项目

```bash
# 克隆或创建项目
git clone &lt;repository-url&gt;
cd simple-demo

# 查看项目结构
ls -la
```

### 2. 配置 MCP 服务器

在你的 OpenClaw 配置中添加 Projitive MCP 服务器：

```json
{
  "mcpServers": {
    "projitive": {
      "command": "npx",
      "args": ["-y", "@projitive/mcp"],
      "env": {
        "PROJITIVE_SCAN_ROOT_PATHS": "/path/to/workspace-a:/path/to/workspace-b",
        "PROJITIVE_SCAN_MAX_DEPTH": "3"
      }
    }
  }
}
```

说明：`PROJITIVE_SCAN_ROOT_PATHS` 使用系统分隔符拼接多个目录（Linux/macOS 用 `:`，Windows 用 `;`）。

### 3. 开始使用

AI 代理现在可以：
- 自动发现项目
- 管理任务
- 创建执行报告
- 维护完整的证据链

## 学习资源

- [Projitive 主文档](../../README.md)
- [治理说明](./.projitive/README.md)
- [项目路线图](./.projitive/roadmap.md)
- [任务列表](./.projitive/tasks.md)

## 许可证

MIT License
