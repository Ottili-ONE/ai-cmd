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
});
