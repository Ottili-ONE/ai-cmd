import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { DEFAULT_CONFIG_PATH, getEnvValue } from "./env.js";
import type { AppConfig, ProviderName } from "../types/index.js";
import { ConfigurationError } from "../utils/errors.js";

const providerSchema = z.enum(["openai", "ollama", "vllm"]);

const providerDefaults: Record<
  ProviderName,
  {
    model: string;
    baseUrl: string;
    requiresApiKey: boolean;
  }
> = {
  openai: {
    model: "gpt-5.4-mini",
    baseUrl: "https://api.openai.com/v1",
    requiresApiKey: true
  },
  ollama: {
    model: "gemma3:4b",
    baseUrl: "http://localhost:11434/api",
    requiresApiKey: false
  },
  vllm: {
    model: "google/gemma-3-4b-it",
    baseUrl: "http://localhost:8000/v1",
    requiresApiKey: false
  }
};

const partialConfigSchema = z.object({
  provider: providerSchema.optional(),
  model: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  timeoutMs: z.number().int().positive().optional()
});

const finalConfigSchema = z.object({
  provider: providerSchema,
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url(),
  timeoutMs: z.number().int().positive()
});

export type LoadConfigOptions = {
  env?: NodeJS.ProcessEnv;
  configPath?: string;
  readConfigFile?: (configPath: string) => Promise<string>;
  ensureConfigScaffold?: (configPath: string) => Promise<void>;
};

const DEFAULT_CONFIG_TEMPLATE = {
  provider: "openai",
  model: "gpt-5.4-mini",
  apiKey: "your-api-key-here",
  baseUrl: "https://api.openai.com/v1",
  timeoutMs: 30_000
};

export async function ensureDefaultConfigScaffold(
  configPath: string
): Promise<void> {
  await mkdir(path.dirname(configPath), { recursive: true });

  try {
    await writeFile(
      configPath,
      `${JSON.stringify(DEFAULT_CONFIG_TEMPLATE, null, 2)}\n`,
      {
        flag: "wx"
      }
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return;
    }

    throw new ConfigurationError(`Failed to create ${configPath}.`, error);
  }
}

export async function loadUserConfig(
  configPath = DEFAULT_CONFIG_PATH,
  readConfigFile: (configPath: string) => Promise<string> = (inputPath) =>
    readFile(inputPath, "utf8")
): Promise<Partial<AppConfig>> {
  try {
    const rawConfig = await readConfigFile(configPath);
    const parsed = JSON.parse(rawConfig) as unknown;
    const validated = partialConfigSchema.parse(parsed);

    return {
      ...(validated.provider ? { provider: validated.provider } : {}),
      ...(validated.model ? { model: validated.model } : {}),
      ...(validated.apiKey ? { apiKey: validated.apiKey } : {}),
      ...(validated.baseUrl ? { baseUrl: validated.baseUrl } : {}),
      ...(validated.timeoutMs ? { timeoutMs: validated.timeoutMs } : {})
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return {};
    }

    if (error instanceof SyntaxError) {
      throw new ConfigurationError(
        `Failed to parse ${configPath}: invalid JSON.`,
        error
      );
    }

    if (error instanceof z.ZodError) {
      throw new ConfigurationError(
        `Invalid configuration in ${configPath}.`,
        error.flatten()
      );
    }

    throw new ConfigurationError(`Failed to read ${configPath}.`, error);
  }
}

export async function loadConfig(
  options: LoadConfigOptions = {}
): Promise<AppConfig> {
  const env = options.env ?? process.env;
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  const ensureConfigScaffold =
    options.ensureConfigScaffold ?? ensureDefaultConfigScaffold;
  const fileConfig = await loadUserConfig(configPath, options.readConfigFile);
  const rawProvider =
    getEnvValue(env, "AI_PROVIDER") ?? fileConfig.provider ?? "openai";
  const providerResult = providerSchema.safeParse(rawProvider);

  if (!providerResult.success) {
    throw new ConfigurationError(
      "Invalid AI provider. Supported providers: openai, ollama, vllm.",
      providerResult.error.flatten()
    );
  }

  const provider = providerResult.data;
  const defaults = providerDefaults[provider];

  const merged = {
    provider,
    model: getEnvValue(env, "AI_MODEL") ?? fileConfig.model ?? defaults.model,
    apiKey: getEnvValue(env, "AI_API_KEY") ?? fileConfig.apiKey,
    baseUrl: getEnvValue(env, "AI_BASE_URL") ?? fileConfig.baseUrl ?? defaults.baseUrl,
    timeoutMs:
      Number.parseInt(
        getEnvValue(env, "AI_TIMEOUT_MS") ?? String(fileConfig.timeoutMs ?? 30_000),
        10
      ) || 30_000
  };

  const parsed = finalConfigSchema.safeParse(merged);

  if (!parsed.success) {
    if (defaults.requiresApiKey && !merged.apiKey) {
      await ensureConfigScaffold(configPath);
      throw new ConfigurationError(
        `Missing AI_API_KEY. Set it in your environment or edit ${configPath}. A starter config has been created if it did not already exist.`
      );
    }

    throw new ConfigurationError("Invalid AI configuration.", parsed.error.flatten());
  }

  if (defaults.requiresApiKey && !parsed.data.apiKey) {
    await ensureConfigScaffold(configPath);
    throw new ConfigurationError(
      `Missing AI_API_KEY. Set it in your environment or edit ${configPath}. A starter config has been created if it did not already exist.`
    );
  }

  return {
    provider: parsed.data.provider,
    model: parsed.data.model,
    baseUrl: parsed.data.baseUrl,
    timeoutMs: parsed.data.timeoutMs,
    ...(parsed.data.apiKey ? { apiKey: parsed.data.apiKey } : {})
  };
}
