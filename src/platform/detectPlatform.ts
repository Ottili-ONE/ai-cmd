import { readFile } from "node:fs/promises";
import path from "node:path";

import { detectServiceManager } from "./detectServiceManager.js";
import { detectShell } from "./detectShell.js";
import type { OperatingSystem, PlatformContext } from "../types/index.js";

export type InferOperatingSystemOptions = {
  platform: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  procVersion?: string;
};

export function inferOperatingSystem(
  options: InferOperatingSystemOptions
): OperatingSystem {
  if (options.platform === "darwin") {
    return "macos";
  }

  if (options.platform === "linux") {
    const wslEnv =
      options.env?.WSL_DISTRO_NAME ||
      options.env?.WSL_INTEROP ||
      options.procVersion?.toLowerCase().includes("microsoft");

    return wslEnv ? "wsl" : "linux";
  }

  if (options.platform === "freebsd" || options.platform === "openbsd") {
    return "unix";
  }

  return "unsupported";
}

async function readProcVersion(): Promise<string | undefined> {
  try {
    return await readFile("/proc/version", "utf8");
  } catch {
    return undefined;
  }
}

export async function detectOperatingSystem(): Promise<OperatingSystem> {
  const procVersion = process.platform === "linux" ? await readProcVersion() : undefined;

  return inferOperatingSystem({
    platform: process.platform,
    env: process.env,
    ...(procVersion ? { procVersion } : {})
  });
}

export async function detectPlatformContext(): Promise<PlatformContext> {
  const os = await detectOperatingSystem();
  const shell = detectShell();
  const serviceManager = await detectServiceManager(os);
  const cwd = process.cwd();

  return {
    os,
    shell,
    serviceManager,
    cwd,
    cwdName: path.basename(cwd) || cwd
  };
}
