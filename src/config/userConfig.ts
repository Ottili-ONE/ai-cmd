import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { DEFAULT_CONFIG_PATH, getEnvValue } from "./env.js";
import type { AppConfig } from "../types/index.js";
import { ConfigurationError } from "../utils/errors.js";

const partialConfigSchema = z.object({
  provider: z.literal("openai").optional(),
  model: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  timeoutMs: z.number().int().positive().optional()
});

const finalConfigSchema = z.object({
  provider: z.literal("openai").default("openai"),
  model: z.string().min(1).default("gpt-4.1-mini"),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().default("https://api.openai.com/v1"),
  timeoutMs: z.number().int().positive().default(30_000)
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

  const merged = {
    provider: getEnvValue(env, "AI_PROVIDER") ?? fileConfig.provider ?? "openai",
    model: getEnvValue(env, "AI_MODEL") ?? fileConfig.model ?? "gpt-4.1-mini",
    apiKey: getEnvValue(env, "AI_API_KEY") ?? fileConfig.apiKey,
    baseUrl:
      getEnvValue(env, "AI_BASE_URL") ??
      fileConfig.baseUrl ??
      "https://api.openai.com/v1",
    timeoutMs:
      Number.parseInt(
        getEnvValue(env, "AI_TIMEOUT_MS") ?? String(fileConfig.timeoutMs ?? 30_000),
        10
      ) || 30_000
  };

  const parsed = finalConfigSchema.safeParse(merged);

  if (!parsed.success) {
    if (!merged.apiKey) {
      await ensureConfigScaffold(configPath);
      throw new ConfigurationError(
        `Missing AI_API_KEY. Set it in your environment or edit ${configPath}. A starter config has been created if it did not already exist.`
      );
    }

    throw new ConfigurationError("Invalid AI configuration.", parsed.error.flatten());
  }

  return parsed.data;
}
