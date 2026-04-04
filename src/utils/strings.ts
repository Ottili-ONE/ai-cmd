export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeOptionalList(
  values: string[] | undefined
): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const items = values
    .map((value) => normalizeText(value))
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);

  return items.length > 0 ? items : undefined;
}

export function stripMarkdownCodeFence(input: string): string {
  return input
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function extractFirstJsonObject(input: string): string {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return input.trim();
  }

  return input.slice(start, end + 1).trim();
}

export function hasMultipleCommandLines(command: string): boolean {
  return command.split(/\r?\n/).filter((line) => line.trim().length > 0).length > 1;
}
