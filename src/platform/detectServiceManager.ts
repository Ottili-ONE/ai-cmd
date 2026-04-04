import { access } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";

import type { OperatingSystem, ServiceManager } from "../types/index.js";

export async function commandExists(
  command: string,
  envPath = process.env.PATH
): Promise<boolean> {
  if (!envPath) {
    return false;
  }

  for (const entry of envPath.split(path.delimiter)) {
    const fullPath = path.join(entry, command);

    try {
      await access(fullPath, constants.X_OK);
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

export async function detectServiceManager(
  os: OperatingSystem,
  exists: (command: string) => Promise<boolean> = commandExists
): Promise<ServiceManager> {
  if (os === "macos") {
    return "launchctl";
  }

  if (os !== "linux" && os !== "wsl" && os !== "unix") {
    return "unknown";
  }

  if (await exists("systemctl")) {
    return "systemctl";
  }

  if (await exists("service")) {
    return "service";
  }

  if (await exists("rc-service")) {
    return "rc-service";
  }

  return "unknown";
}
