import type { AppConfig, AIProvider } from "../types/index.js";
import { ConfigurationError } from "../utils/errors.js";
import { OpenAICompatibleProvider } from "./openai.js";

export function createProvider(config: AppConfig): AIProvider {
  if (config.provider === "openai") {
    return new OpenAICompatibleProvider(config);
  }

  throw new ConfigurationError(`Unsupported AI provider: ${config.provider}`);
}
