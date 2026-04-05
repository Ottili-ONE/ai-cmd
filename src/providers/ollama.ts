import type { AppConfig, GenerateObjectRequest, ProviderTextResponse } from "../types/index.js";
import type { AIProvider } from "./types.js";
import { ProviderError } from "../utils/errors.js";

type OllamaChatResponse = {
  model?: string;
  message?: {
    content?: string;
  };
  error?: string;
};

export class OllamaProvider implements AIProvider {
  public readonly name = "ollama" as const;

  public constructor(private readonly config: AppConfig) {}

  public async generateObject(
    input: GenerateObjectRequest
  ): Promise<ProviderTextResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          stream: false,
          format: input.jsonSchema,
          options: {
            temperature: input.temperature ?? 0.1
          },
          messages: [
            {
              role: "system",
              content: input.systemPrompt
            },
            {
              role: "user",
              content: input.userPrompt
            }
          ]
        }),
        signal: controller.signal
      });

      const data = (await response.json()) as OllamaChatResponse;

      if (!response.ok) {
        throw new ProviderError(
          data.error
            ? `Provider request failed: ${data.error}`
            : `Provider request failed with status ${response.status}.`
        );
      }

      const rawText = data.message?.content;

      if (!rawText || rawText.trim().length === 0) {
        throw new ProviderError("Provider returned an empty response.");
      }

      return {
        provider: this.name,
        model: data.model ?? this.config.model,
        rawText
      };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }

      if ((error as Error).name === "AbortError") {
        throw new ProviderError(
          `Provider request timed out after ${this.config.timeoutMs}ms.`,
          error
        );
      }

      throw new ProviderError("Failed to reach AI provider.", error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
