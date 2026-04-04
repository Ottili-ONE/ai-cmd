import { homedir } from "node:os";
import path from "node:path";

export const DEFAULT_CONFIG_PATH = path.join(
  homedir(),
  ".ai-cmd",
  "config.json"
);

export function getEnvValue(
  env: NodeJS.ProcessEnv,
  key: string
): string | undefined {
  const value = env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}
