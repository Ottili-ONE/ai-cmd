import type { AppConfig, GenerateObjectRequest, ProviderTextResponse } from "../types/index.js";
import type { AIProvider } from "./types.js";
import { ProviderError } from "../utils/errors.js";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export class OpenAICompatibleProvider implements AIProvider {
  public readonly name = "openai" as const;

  public constructor(private readonly config: AppConfig) {}

  public async generateObject(
    input: GenerateObjectRequest
  ): Promise<ProviderTextResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: input.temperature ?? 0.1,
          response_format: {
            type: "json_object"
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

      const data = (await response.json()) as OpenAIChatResponse;

      if (!response.ok) {
        throw new ProviderError(
          data.error?.message
            ? `Provider request failed: ${data.error.message}`
            : `Provider request failed with status ${response.status}.`
        );
      }

      const message = data.choices?.[0]?.message?.content;
      const rawText = Array.isArray(message)
        ? message
            .map((part) => part.text)
            .filter((part): part is string => typeof part === "string")
            .join("")
        : message;

      if (!rawText || rawText.trim().length === 0) {
        throw new ProviderError("Provider returned an empty response.");
      }

      return {
        provider: this.name,
        model: this.config.model,
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
