import type {
  AppConfig,
  GenerateObjectRequest,
  ProviderTextResponse
} from "../types/index.js";
import type { AIProvider } from "./types.js";
import { ProviderError } from "../utils/errors.js";
import { fetchJson } from "./httpClient.js";

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
    try {
      const data = (await fetchJson(
        `${this.config.baseUrl}/models/${encodeURIComponent(this.config.model)}:generateContent?key=${encodeURIComponent(this.config.apiKey ?? "")}`,
        {
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
          timeoutMs: this.config.timeoutMs
        }
      )) as GoogleGenerateContentResponse;

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

      throw new ProviderError("Failed to reach AI provider.", error);
    }
  }
}
