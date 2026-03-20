import fs from 'node:fs'
import path from 'node:path'

const MESSAGE_TEMPLATE_ENV = 'PROJITIVE_MESSAGE_TEMPLATE_PATH'
const CONTENT_TEMPLATE_TOKEN = '{{content}}'

function baseToolTemplateMarkdown(): string {
  return [
  '# {{tool_name}}',
  '',
  '## Summary',
  '{{summary}}',
  '',
  '## Evidence',
  '{{evidence}}',
  '',
  '## Agent Guidance',
  '{{guidance}}',
  '',
  '## Next Call',
  '{{next_call}}',
  '',
  '## Raw Response',
  '{{content}}',
  ].join('\n')
}

export function getDefaultToolTemplateMarkdown(toolName: string): string {
  const base = baseToolTemplateMarkdown()

  if (toolName === 'taskNext') {
    return [
      base,
      '',
      '## Idle Discovery Checklist (When No Actionable Task)',
      '- Scan backlog comments: TODO / FIXME / HACK / XXX.',
      '- Check lint gaps and create executable fix tasks.',
      '- Check test quality gaps (missing tests, flaky tests, low-value coverage).',
      '- Learn current project architecture and consolidate/update design docs in designs/.',
      '- Review and update architecture docs under designs/core/ (architecture.md, style-guide.md) if missing or outdated.',
      '- Re-run {{tool_name}} after creating 1-3 focused TODO tasks.',
    ].join('\n')
  }

  if (toolName === 'projectContext' || toolName === 'taskContext' || toolName === 'roadmapContext') {
    return [
      base,
      '',
      '## Common Tool Guides To Read First',
      '- ./CLAUDE.md',
      '- ./AGENTS.md',
      '- ./.github/copilot-instructions.md',
      '- ./.cursorrules',
      '- ./.github/instructions/*',
      '- ./.cursor/rules/*',
    ].join('\n')
  }

  if (toolName === 'taskUpdate' || toolName === 'roadmapUpdate') {
    return [
      base,
      '',
      '## Commit Reminder',
      '- After this update, create a commit to keep progress auditable.',
      '- Recommended format: type(scope): summary',
      '- Example: feat(task): complete TASK-0007 validation flow',
      '- Footer suggestion: Refs: TASK-0007, ROADMAP-0002',
    ].join('\n')
  }

  return base
}

function loadTemplateFile(templatePath: string): string | undefined {
  try {
    const content = fs.readFileSync(templatePath, 'utf-8').trim()
    return content.length > 0 ? content : undefined
  } catch {
    return undefined
  }
}

function ensureTemplateFile(templatePath: string, toolName: string): string {
  const existing = loadTemplateFile(templatePath)
  if (existing) {
    return existing
  }

  fs.mkdirSync(path.dirname(templatePath), { recursive: true })
  const generated = getDefaultToolTemplateMarkdown(toolName)
  fs.writeFileSync(templatePath, `${generated}\n`, 'utf-8')
  return generated
}

function resolveTemplateTarget(toolName: string): string {
  const configuredPath = process.env[MESSAGE_TEMPLATE_ENV]?.trim()
  if (!configuredPath) {
    return path.resolve(process.cwd(), '.projitive', 'templates', 'tools', `${toolName}.md`)
  }

  const absolutePath = path.resolve(configuredPath)
  try {
    const stat = fs.statSync(absolutePath)
    if (stat.isDirectory()) {
      return path.join(absolutePath, `${toolName}.md`)
    }
    return absolutePath
  } catch {
    const ext = path.extname(absolutePath).toLowerCase()
    if (ext === '.md') {
      return absolutePath
    }
    return path.join(absolutePath, `${toolName}.md`)
  }
}

function loadMessageTemplate(toolName: string): string {
  const templatePath = resolveTemplateTarget(toolName)
  return ensureTemplateFile(templatePath, toolName)
}

export function asText(markdown: string) {
  return {
    content: [{ type: 'text' as const, text: markdown }],
  }
}

function withFallback(lines: string[]): string[] {
  return lines.length > 0 ? lines : ['- (none)']
}

function shouldKeepRawLine(trimmed: string): boolean {
  if (trimmed.length === 0) {
    return true
  }

  if (trimmed.startsWith('#') || trimmed.startsWith('>') || trimmed.startsWith('```')) {
    return true
  }

  if (/^[-*+]\s/.test(trimmed)) {
    return true
  }

  if (/^\d+\.\s/.test(trimmed)) {
    return true
  }

  return false
}

function normalizeLine(line: string): string {
  const trimmed = line.trim()
  if (shouldKeepRawLine(trimmed)) {
    return line
  }
  return `- ${trimmed}`
}

function normalizeLines(lines: string[]): string[] {
  return lines.map((line) => normalizeLine(line))
}

export type ToolSectionTitle = 'Summary' | 'Evidence' | 'Agent Guidance' | 'Lint Suggestions' | 'Next Call' | 'Error' | 'Next Step' | 'Retry Example';

export type ToolResponseSection = {
  title: ToolSectionTitle | string;
  lines: string[];
};

export type ToolResponsePayload = {
  toolName: string;
  sections: ToolResponseSection[];
};

type ToolTemplateVariables = Record<string, string>;

export function section(title: ToolSectionTitle | string, lines: string[]): ToolResponseSection {
  return { title, lines: normalizeLines(lines) }
}

export function summarySection(lines: string[]): ToolResponseSection {
  return section('Summary', lines)
}

export function evidenceSection(lines: string[]): ToolResponseSection {
  return section('Evidence', lines)
}

export function guidanceSection(lines: string[]): ToolResponseSection {
  return section('Agent Guidance', lines)
}

export function lintSection(lines: string[]): ToolResponseSection {
  return section('Lint Suggestions', lines)
}

export function nextCallSection(nextCall?: string): ToolResponseSection {
  return section('Next Call', nextCall ? [nextCall] : [])
}

function toSectionText(section: ToolResponseSection | undefined): string {
  if (!section) {
    return '- (none)'
  }
  return withFallback(section.lines).join('\n')
}

function resolveSection(payload: ToolResponsePayload, title: ToolSectionTitle): ToolResponseSection | undefined {
  return payload.sections.find((item) => item.title === title)
}

function buildToolTemplateVariables(payload: ToolResponsePayload, classicMarkdown: string): ToolTemplateVariables {
  return {
    tool_name: payload.toolName,
    content: classicMarkdown,
    summary: toSectionText(resolveSection(payload, 'Summary')),
    evidence: toSectionText(resolveSection(payload, 'Evidence')),
    guidance: toSectionText(resolveSection(payload, 'Agent Guidance')),
    next_call: toSectionText(resolveSection(payload, 'Next Call')),
  }
}

function applyTemplateVariables(template: string, variables: ToolTemplateVariables): string {
  let rendered = template
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.split(`{{${key}}}`).join(value)
  }

  if (!rendered.includes(variables.content) && !template.includes(CONTENT_TEMPLATE_TOKEN)) {
    rendered = `${rendered}\n\n${variables.content}`
  }

  return rendered.trimEnd()
}

export function renderToolResponseMarkdown(payload: ToolResponsePayload): string {
  const body = payload.sections.flatMap((section) => [
    `## ${section.title}`,
    ...withFallback(section.lines),
    '',
  ])

  const classicMarkdown = [
    `# ${payload.toolName}`,
    '',
    ...body,
  ].join('\n').trimEnd()

  const template = loadMessageTemplate(payload.toolName)
  const variables = buildToolTemplateVariables(payload, classicMarkdown)
  return applyTemplateVariables(template, variables)
}

export function renderErrorMarkdown(toolName: string, cause: string, nextSteps: string[], retryExample?: string): string {
  return renderToolResponseMarkdown({
    toolName,
    sections: [
      section('Error', [`cause: ${cause}`]),
      section('Next Step', nextSteps),
      section('Retry Example', [retryExample ?? '(none)']),
    ],
  })
}
