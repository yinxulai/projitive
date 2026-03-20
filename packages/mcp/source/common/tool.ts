import { z } from 'zod'
import type { ZodRawShape } from 'zod'
import {
  asText,
  renderToolResponseMarkdown,
  renderErrorMarkdown,
  evidenceSection,
  guidanceSection,
  lintSection,
  nextCallSection,
  summarySection,
} from './response.js'

export type ToolRuntimeContext = {
  now: string
}

export type ToolSpec<TShape extends ZodRawShape, TData> = {
  name: string
  title: string
  description: string
  inputSchema: TShape
  execute: (input: z.infer<z.ZodObject<TShape>>, ctx: ToolRuntimeContext) => Promise<TData>
  primary: (data: TData, ctx: ToolRuntimeContext) => string[] | Promise<string[]>
  evidence?: (data: TData, ctx: ToolRuntimeContext) => string[] | Promise<string[]>
  guidance: (data: TData, ctx: ToolRuntimeContext) => string[] | Promise<string[]>
  suggestions?: (data: TData, ctx: ToolRuntimeContext) => string[] | Promise<string[]>
  nextCall: (data: TData, ctx: ToolRuntimeContext) => string | undefined | Promise<string | undefined>
}

export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly nextSteps: string[] = [],
    public readonly retryExample?: string,
  ) {
    super(message)
    this.name = 'ToolExecutionError'
  }
}

type ToolResponse = { content: { type: 'text'; text: string }[]; isError?: boolean }
type ToolCb<TShape extends ZodRawShape> = (input: z.infer<z.ZodObject<TShape>>) => Promise<ToolResponse>

export function createGovernedTool<TShape extends ZodRawShape, TData>(
  spec: ToolSpec<TShape, TData>,
): [string, { title: string; description: string; inputSchema: TShape }, ToolCb<TShape>] {
  const cb: ToolCb<TShape> = async (input) => {
    try {
      const ctx: ToolRuntimeContext = { now: new Date().toISOString() }
      const data = await spec.execute(input, ctx)
      const markdown = renderToolResponseMarkdown({
        toolName: spec.name,
        sections: [
          summarySection(await spec.primary(data, ctx)),
          evidenceSection(await (spec.evidence?.(data, ctx) ?? [])),
          guidanceSection(await spec.guidance(data, ctx)),
          lintSection(await (spec.suggestions?.(data, ctx) ?? [])),
          nextCallSection(await spec.nextCall(data, ctx)),
        ],
      })
      return asText(markdown)
    } catch (error) {
      if (error instanceof ToolExecutionError) {
        return {
          ...asText(renderErrorMarkdown(spec.name, error.message, error.nextSteps, error.retryExample)),
          isError: true,
        }
      }
      return {
        ...asText(renderErrorMarkdown(spec.name, String(error), [])),
        isError: true,
      }
    }
  }
  return [spec.name, { title: spec.title, description: spec.description, inputSchema: spec.inputSchema }, cb]
}
