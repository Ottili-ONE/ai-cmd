import type {
  AppConfig,
  GenerateObjectRequest,
  ProviderTextResponse
} from "../types/index.js";
import type { AIProvider } from "./types.js";
import { providerRequest } from "./providerRequest.js";

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
    return providerRequest<GoogleGenerateContentResponse>(
      this.name,
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
        })
      },
      this.config.timeoutMs,
      this.config.model,
      (data) => ({
        rawText: data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text)
          .filter((part): part is string => typeof part === "string")
          .join(""),
        error: data.error?.message
      })
    );
  }
}
