export type LintSuggestion = {
  code: string;
  message: string;
  fixHint?: string;
}

export function renderLintSuggestions(suggestions: LintSuggestion[]): string[] {
  return suggestions.map((item) => {
    const suffix = item.fixHint ? ` ${item.fixHint}` : ""
    return `- [${item.code}] ${item.message}${suffix}`
  })
}
