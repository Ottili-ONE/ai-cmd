import type {
  AppConfig,
  GenerateObjectRequest,
  ProviderTextResponse
} from "../types/index.js";
import type { AIProvider } from "./types.js";
import { providerRequest } from "./providerRequest.js";

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
    return providerRequest<AnthropicResponse>(
      this.name,
      `${this.config.baseUrl}/messages`,
      {
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
        })
      },
      this.config.timeoutMs,
      this.config.model,
      (data) => ({
        rawText: data.content
          ?.filter((block) => block.type === "text")
          .map((block) => block.text)
          .filter((block): block is string => typeof block === "string")
          .join("") ,
        error: data.error?.message
      })
    );
  }
}
