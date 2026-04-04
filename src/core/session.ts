import type { CommandSuggestion, ConversationTurn } from "../types/index.js";

export class InMemorySession {
  private history: ConversationTurn[] = [];
  private lastSuggestion: CommandSuggestion | undefined;

  public remember(question: string, suggestion: CommandSuggestion): void {
    this.lastSuggestion = suggestion;
    this.history.push({
      question,
      command: suggestion.command,
      explanation: suggestion.explanation
    });
  }

  public getHistory(limit = 4): ConversationTurn[] {
    return this.history.slice(-limit);
  }

  public getLastSuggestion(): CommandSuggestion | undefined {
    return this.lastSuggestion;
  }

  public clear(): void {
    this.history = [];
    this.lastSuggestion = undefined;
  }
}
