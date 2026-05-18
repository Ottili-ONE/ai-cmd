import type { AppConfig, GenerateObjectRequest, ProviderTextResponse } from "../types/index.js";
import type { AIProvider } from "./types.js";
import { providerRequest } from "./providerRequest.js";

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
    return providerRequest<OllamaChatResponse>(
      this.name,
      `${this.config.baseUrl}/chat`,
      {
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
        })
      },
      this.config.timeoutMs,
      this.config.model,
      (data) => ({ rawText: data.message?.content, model: data.model, error: data.error })
    );
  }
}
