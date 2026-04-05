import { describe, expect, it, vi } from "vitest";

import { runConfigurator } from "../../src/config/configurator.js";
import type { AppConfig, ProviderName } from "../../src/types/index.js";

function createPrompt(options: {
  provider: ProviderName;
  apiKey: string;
  analytics: boolean;
}) {
  return {
    select: vi.fn().mockResolvedValue(options.provider),
    text: vi.fn().mockResolvedValue(options.apiKey),
    password: vi.fn().mockResolvedValue(options.apiKey),
    confirm: vi.fn().mockResolvedValue(options.analytics)
  };
}

describe("runConfigurator", () => {
  it("saves a fully configured OpenAI setup with analytics opt-in", async () => {
    const prompt = createPrompt({
      provider: "openai",
      apiKey: "openai-key",
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
      analytics: false
    });

    const config = await runConfigurator({
      configPath: "/tmp/config.json",
      prompt,
      saveConfig: async () => undefined
    });

    expect(config.provider).toBe("ollama");
    expect(config.apiKey).toBeUndefined();
    expect(config.analytics).toBe(false);
    expect(config.analyticsId).toBeUndefined();
  });
});
