import type { AppConfig, GenerateObjectRequest, ProviderTextResponse } from "../types/index.js";
import type { AIProvider } from "./types.js";
import { providerRequest } from "./providerRequest.js";

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
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    return providerRequest<OpenAIChatResponse>(
      this.name,
      `${this.config.baseUrl}/chat/completions`,
      {
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
        })
      },
      this.config.timeoutMs,
      this.config.model,
      (data) => {
        const message = data.choices?.[0]?.message?.content;
        const rawText = Array.isArray(message)
          ? message
              .map((part) => part.text)
              .filter((part): part is string => typeof part === "string")
              .join("")
          : (message as string | undefined);

        return { rawText, error: data.error?.message };
      }
    );
  }
}
