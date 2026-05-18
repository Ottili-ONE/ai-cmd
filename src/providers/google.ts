import type {
  AppConfig,
  GenerateObjectRequest,
  ProviderTextResponse
} from "../types/index.js";
import type { AIProvider } from "./types.js";
import { ProviderError } from "../utils/errors.js";

type GoogleGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export class GoogleProvider implements AIProvider {
  public readonly name = "google" as const;

  public constructor(private readonly config: AppConfig) {}

  public async generateObject(
    input: GenerateObjectRequest
  ): Promise<ProviderTextResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const base = `${this.config.baseUrl}/models/${encodeURIComponent(
        this.config.model
      )}:generateContent`;
      const url = this.config.apiKey
        ? `${base}?key=${encodeURIComponent(this.config.apiKey)}`
        : base;

      const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: input.systemPrompt
                }
              ]
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: input.userPrompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: input.temperature ?? 0.1,
              responseMimeType: "application/json",
              responseSchema: input.jsonSchema
            }
          }),
          signal: controller.signal
        }
      );

      const data = (await response.json()) as GoogleGenerateContentResponse;

      if (!response.ok) {
        throw new ProviderError(
          data.error?.message
            ? `Provider request failed: ${data.error.message}`
            : `Provider request failed with status ${response.status}.`
        );
      }

      const rawText = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .filter((part): part is string => typeof part === "string")
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
