export type RequiredReadingItem = {
  source: "Local" | "External";
  value: string;
};

export function parseRequiredReading(markdown: string): RequiredReadingItem[] {
  const lines = markdown.split(/\r?\n/);
  const result: RequiredReadingItem[] = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^##\s+(Required Reading for Agents|Agent 必读)$/i.test(trimmed)) {
      inSection = true;
      continue;
    }

    if (inSection && trimmed.startsWith("## ")) {
      break;
    }

    if (!inSection || !trimmed.startsWith("- ")) {
      continue;
    }

    const payload = trimmed.replace(/^-\s+/, "");
    if (payload.startsWith("Local:")) {
      result.push({ source: "Local", value: payload.replace("Local:", "").trim() });
    }
    if (payload.startsWith("External:")) {
      result.push({ source: "External", value: payload.replace("External:", "").trim() });
    }
  }

  return result;
}
