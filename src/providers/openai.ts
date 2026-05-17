import type { AppConfig, GenerateObjectRequest, ProviderTextResponse } from "../types/index.js";
import type { AIProvider } from "./types.js";
import { ProviderError } from "../utils/errors.js";
import { fetchJson } from "./httpClient.js";

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
  public constructor(
    public readonly name: "openai" | "vllm",
    private readonly config: AppConfig
  ) {}

  public async generateObject(
    input: GenerateObjectRequest
  ): Promise<ProviderTextResponse> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (this.config.apiKey) {
        headers.Authorization = `Bearer ${this.config.apiKey}`;
      }

      const data = (await fetchJson(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
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
        timeoutMs: this.config.timeoutMs
      })) as OpenAIChatResponse;

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

      throw new ProviderError("Failed to reach AI provider.", error);
    }
  }
}
