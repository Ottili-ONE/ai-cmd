import type { ProviderName } from "../types/index.js";

export interface ProviderDefinition {
  label: string;
  model: string;
  baseUrl: string;
  requiresApiKey: boolean;
}

export const providerDefaults: Record<ProviderName, ProviderDefinition> = {
  openai: {
    label: "OpenAI",
    model: "gpt-5.4-mini",
    baseUrl: "https://api.openai.com/v1",
    requiresApiKey: true
  },
  anthropic: {
    label: "Anthropic",
    model: "claude-sonnet-4-20250514",
    baseUrl: "https://api.anthropic.com/v1",
    requiresApiKey: true
  },
  ollama: {
    label: "Ollama",
    model: "gemma3:4b",
    baseUrl: "http://localhost:11434/api",
    requiresApiKey: false
  },
  google: {
    label: "Google",
    model: "gemini-2.5-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    requiresApiKey: true
  },
  vllm: {
    label: "vLLM",
    model: "google/gemma-3-4b-it",
    baseUrl: "http://localhost:8000/v1",
    requiresApiKey: false
  }
};
