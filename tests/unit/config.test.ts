import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config/userConfig.js";
import { ConfigurationError } from "../../src/utils/errors.js";

describe("loadConfig", () => {
  it("prefers environment variables over file config", async () => {
    const config = await loadConfig({
      env: {
        AI_API_KEY: "env-key",
        AI_MODEL: "gpt-env"
      },
      readConfigFile: async () =>
        JSON.stringify({
          apiKey: "file-key",
          model: "gpt-file",
          baseUrl: "https://example.com/v1"
        })
    });

    expect(config.apiKey).toBe("env-key");
    expect(config.model).toBe("gpt-env");
    expect(config.baseUrl).toBe("https://example.com/v1");
    expect(config.analytics).toBe(false);
  });

  it("throws a clear error when the API key is missing", async () => {
    const ensureConfigScaffold = async () => undefined;

    await expect(
      loadConfig({
        env: {},
        readConfigFile: async () => JSON.stringify({}),
        ensureConfigScaffold
      })
    ).rejects.toThrowError(ConfigurationError);
  });

  it("creates a starter config scaffold when the API key is missing", async () => {
    let scaffoldPath = "";

    await expect(
      loadConfig({
        env: {},
        configPath: "C:\\Users\\Willi\\.ai-cmd\\config.json",
        readConfigFile: async () => JSON.stringify({}),
        ensureConfigScaffold: async (configPath) => {
          scaffoldPath = configPath;
        }
      })
    ).rejects.toThrowError(/starter config has been created/i);

    expect(scaffoldPath).toBe("C:\\Users\\Willi\\.ai-cmd\\config.json");
  });

  it("throws a clear error for invalid JSON config", async () => {
    await expect(
      loadConfig({
        env: {
          AI_API_KEY: "env-key"
        },
        readConfigFile: async () => "{not-valid-json"
      })
    ).rejects.toThrowError(/invalid JSON/i);
  });

  it("loads Ollama defaults without requiring an API key", async () => {
    const config = await loadConfig({
      env: {
        AI_PROVIDER: "ollama"
      },
      readConfigFile: async () => JSON.stringify({})
    });

    expect(config.provider).toBe("ollama");
    expect(config.model).toBe("gemma3:4b");
    expect(config.baseUrl).toBe("http://localhost:11434/api");
    expect(config.apiKey).toBeUndefined();
    expect(config.analytics).toBe(false);
  });

  it("loads vLLM defaults without requiring an API key", async () => {
    const config = await loadConfig({
      env: {
        AI_PROVIDER: "vllm"
      },
      readConfigFile: async () => JSON.stringify({})
    });

    expect(config.provider).toBe("vllm");
    expect(config.model).toBe("google/gemma-3-4b-it");
    expect(config.baseUrl).toBe("http://localhost:8000/v1");
    expect(config.apiKey).toBeUndefined();
    expect(config.analytics).toBe(false);
  });

  it("loads Anthropic defaults when selected", async () => {
    const config = await loadConfig({
      env: {
        AI_PROVIDER: "anthropic",
        AI_API_KEY: "anthropic-key"
      },
      readConfigFile: async () => JSON.stringify({})
    });

    expect(config.provider).toBe("anthropic");
    expect(config.model).toBe("claude-sonnet-4-20250514");
    expect(config.baseUrl).toBe("https://api.anthropic.com/v1");
    expect(config.apiKey).toBe("anthropic-key");
  });

  it("loads Google defaults when selected", async () => {
    const config = await loadConfig({
      env: {
        AI_PROVIDER: "google",
        AI_API_KEY: "google-key"
      },
      readConfigFile: async () => JSON.stringify({})
    });

    expect(config.provider).toBe("google");
    expect(config.model).toBe("gemini-2.5-flash");
    expect(config.baseUrl).toBe(
      "https://generativelanguage.googleapis.com/v1beta"
    );
    expect(config.apiKey).toBe("google-key");
  });

  it("reads the analytics opt-in from config.json", async () => {
    const config = await loadConfig({
      env: {},
      readConfigFile: async () =>
        JSON.stringify({
          provider: "openai",
          apiKey: "file-key",
          analytics: true,
          analyticsId: "76f7075b-1d24-46d3-b037-78c4b6460a4b"
        })
    });

    expect(config.analytics).toBe(true);
    expect(config.analyticsId).toBe("76f7075b-1d24-46d3-b037-78c4b6460a4b");
  });

  it("rejects unsupported providers with a clear error", async () => {
    await expect(
      loadConfig({
        env: {
          AI_PROVIDER: "unknown-provider"
        },
        readConfigFile: async () => JSON.stringify({})
      })
    ).rejects.toThrowError(
      /Supported providers: openai, anthropic, ollama, google, vllm/i
    );
  });
});
