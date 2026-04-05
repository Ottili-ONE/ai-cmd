import { describe, expect, it, vi } from "vitest";

import { runConfigurator } from "../../src/config/configurator.js";
import type { AppConfig, ProviderName } from "../../src/types/index.js";

function createPrompt(options: {
  provider: ProviderName;
  apiKey: string;
  textValues?: string[];
  analytics: boolean;
}) {
  const textValues = options.textValues ?? [];

  return {
    select: vi.fn().mockResolvedValue(options.provider),
    text: vi
      .fn()
      .mockImplementation(async () => textValues.shift() ?? options.apiKey),
    password: vi.fn().mockResolvedValue(options.apiKey),
    confirm: vi.fn().mockResolvedValue(options.analytics)
  };
}

describe("runConfigurator", () => {
  it("saves a fully configured OpenAI setup with analytics opt-in", async () => {
    const prompt = createPrompt({
      provider: "openai",
      apiKey: "openai-key",
      textValues: ["gpt-5.4-mini", "https://api.openai.com/v1"],
      analytics: true
    });
    let savedConfig: AppConfig | undefined;

    const config = await runConfigurator({
      configPath: "/tmp/config.json",
      prompt,
      saveConfig: async (value) => {
        savedConfig = value;
      }
    });

    expect(config.provider).toBe("openai");
    expect(config.apiKey).toBe("openai-key");
    expect(config.model).toBe("gpt-5.4-mini");
    expect(config.baseUrl).toBe("https://api.openai.com/v1");
    expect(config.analytics).toBe(true);
    expect(config.analyticsId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(savedConfig).toEqual(config);
  });

  it("stores analytics as false by default when the user opts out", async () => {
    const prompt = createPrompt({
      provider: "ollama",
      apiKey: "",
      textValues: ["", "gemma3:4b", "http://localhost:11434/api"],
      analytics: false
    });

    const config = await runConfigurator({
      configPath: "/tmp/config.json",
      prompt,
      saveConfig: async () => undefined
    });

    expect(config.provider).toBe("ollama");
    expect(config.apiKey).toBeUndefined();
    expect(config.model).toBe("gemma3:4b");
    expect(config.baseUrl).toBe("http://localhost:11434/api");
    expect(config.analytics).toBe(false);
    expect(config.analyticsId).toBeUndefined();
  });
});
