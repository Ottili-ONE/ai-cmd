import type {
  AppConfig,
  GenerateObjectRequest,
  ProviderTextResponse
} from "../types/index.js";
import type { AIProvider } from "./types.js";
import { ProviderError } from "../utils/errors.js";

type AnthropicResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  error?: {
    message?: string;
  };
};

export class AnthropicProvider implements AIProvider {
  public readonly name = "anthropic" as const;

  public constructor(private readonly config: AppConfig) {}

  public async generateObject(
    input: GenerateObjectRequest
  ): Promise<ProviderTextResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": this.config.apiKey ?? ""
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1_024,
          temperature: input.temperature ?? 0.1,
          system: `${input.systemPrompt}\nReturn only a JSON object that matches the requested schema.`,
          messages: [
            {
              role: "user",
              content: input.userPrompt
            }
          ]
        }),
        signal: controller.signal
      });

      const data = (await response.json()) as AnthropicResponse;

      if (!response.ok) {
        throw new ProviderError(
          data.error?.message
            ? `Provider request failed: ${data.error.message}`
            : `Provider request failed with status ${response.status}.`
        );
      }

      const rawText = data.content
        ?.filter((block) => block.type === "text")
        .map((block) => block.text)
        .filter((block): block is string => typeof block === "string")
        .join("");

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
