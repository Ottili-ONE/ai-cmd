import type { CommandSuggestion } from "../types/index.js";

export function explainCommand(suggestion: CommandSuggestion): string {
  return suggestion.explanation;
}
