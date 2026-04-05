import type { AppConfig, AIProvider } from "../types/index.js";
import { ConfigurationError } from "../utils/errors.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAICompatibleProvider } from "./openai.js";

export function createProvider(config: AppConfig): AIProvider {
  if (config.provider === "openai") {
    return new OpenAICompatibleProvider("openai", config);
  }

  if (config.provider === "ollama") {
    return new OllamaProvider(config);
  }

  if (config.provider === "vllm") {
    return new OpenAICompatibleProvider("vllm", config);
  }

  throw new ConfigurationError(`Unsupported AI provider: ${config.provider}`);
}
