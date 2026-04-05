import { randomUUID } from "node:crypto";

import prompts from "prompts";

import { DEFAULT_CONFIG_PATH } from "./env.js";
import { providerDefaults } from "./providerCatalog.js";
import {
  configFileExists,
  ensureDefaultConfigScaffold,
  loadConfig,
  saveUserConfig
} from "./userConfig.js";
import type { AppConfig, ProviderName } from "../types/index.js";
import { ConfigurationError, UserCancelledError } from "../utils/errors.js";

export interface ConfiguratorPromptAdapter {
  select(
    message: string,
    choices: Array<{ title: string; value: ProviderName }>
  ): Promise<ProviderName>;
  text(message: string, initial?: string): Promise<string>;
  password(message: string): Promise<string>;
  confirm(message: string, initial?: boolean): Promise<boolean>;
}

export interface ConfigureAppOptions {
  configPath?: string;
  prompt?: ConfiguratorPromptAdapter;
  saveConfig?: (config: AppConfig, configPath: string) => Promise<void>;
}

export function createConfiguratorPromptAdapter(): ConfiguratorPromptAdapter {
  const onCancel = (): never => {
    throw new UserCancelledError("Configuration cancelled.");
  };

  return {
    async select(message, choices) {
      const response = await prompts(
        {
          type: "select",
          name: "value",
          message,
          choices
        },
        { onCancel }
      );

      return response.value as ProviderName;
    },
    async text(message, initial = "") {
      const response = await prompts(
        {
          type: "text",
          name: "value",
          message,
          initial
        },
        { onCancel }
      );

      return String(response.value ?? "").trim();
    },
    async password(message) {
      const response = await prompts(
        {
          type: "password",
          name: "value",
          message
        },
        { onCancel }
      );

      return String(response.value ?? "").trim();
    },
    async confirm(message, initial = false) {
      const response = await prompts(
        {
          type: "confirm",
          name: "value",
          message,
          initial
        },
        { onCancel }
      );

      return Boolean(response.value);
    }
  };
}

async function promptForRequiredText(options: {
  prompt: ConfiguratorPromptAdapter;
  message: string;
  initial?: string;
  errorMessage: string;
}): Promise<string> {
  const value = await options.prompt.text(options.message, options.initial);

  if (value.length === 0) {
    throw new ConfigurationError(options.errorMessage);
  }

  return value;
}

function ensureValidUrl(value: string, providerLabel: string): string {
  try {
    return new URL(value).toString().replace(/\/$/u, "");
  } catch (error) {
    throw new ConfigurationError(
      `${providerLabel} base URL must be a valid URL.`,
      error
    );
  }
}

export async function runConfigurator(
  options: ConfigureAppOptions = {}
): Promise<AppConfig> {
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  const prompt = options.prompt ?? createConfiguratorPromptAdapter();
  const saveConfig = options.saveConfig ?? saveUserConfig;
  const provider = await prompt.select("AI Provider", [
    { title: "OpenAI", value: "openai" },
    { title: "Anthropic", value: "anthropic" },
    { title: "Ollama", value: "ollama" },
    { title: "Google", value: "google" },
    { title: "vLLM", value: "vllm" }
  ]);
  const providerConfig = providerDefaults[provider];
  const apiKey = providerConfig.requiresApiKey
    ? await prompt.password(`API Key for ${providerConfig.label}`)
    : await prompt.text(`API Key for ${providerConfig.label} (optional)`);
  const model = await promptForRequiredText({
    prompt,
    message: `Model for ${providerConfig.label}`,
    initial: providerConfig.model,
    errorMessage: `${providerConfig.label} requires a model name.`
  });
  const baseUrl = ensureValidUrl(
    await promptForRequiredText({
      prompt,
      message: `Base URL for ${providerConfig.label}`,
      initial: providerConfig.baseUrl,
      errorMessage: `${providerConfig.label} requires a base URL.`
    }),
    providerConfig.label
  );

  if (providerConfig.requiresApiKey && apiKey.length === 0) {
    throw new ConfigurationError(
      `${providerConfig.label} requires an API key.`
    );
  }

  const analytics = await prompt.confirm(
    [
      "Help improve ai-cmd 🚀",
      "Allow anonymous usage analytics?",
      "- No personal data",
      "- No command content stored",
      "- Error reports may include the prompt that caused a failure",
      "",
      "(y/n) (default is no)"
    ].join("\n"),
    false
  );

  const config: AppConfig = {
    provider,
    model,
    baseUrl,
    timeoutMs: 30_000,
    analytics,
    ...(apiKey ? { apiKey } : {}),
    ...(analytics ? { analyticsId: randomUUID() } : {})
  };

  await saveConfig(config, configPath);
  process.stdout.write(`Configurator saved ${configPath}.\n`);

  return config;
}

export async function loadOrConfigureConfig(
  options: ConfigureAppOptions = {}
): Promise<AppConfig> {
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;

  if (await configFileExists(configPath)) {
    return loadConfig({ configPath });
  }

  try {
    return await loadConfig({ configPath });
  } catch (error) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      await ensureDefaultConfigScaffold(configPath);
      throw new ConfigurationError(
        `No config found and the interactive configurator is unavailable in this shell. Edit ${configPath} or set AI_PROVIDER and AI_API_KEY in your environment.`,
        error
      );
    }

    await runConfigurator(options);
    return loadConfig({ configPath });
  }
}
