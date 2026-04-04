import path from "node:path";

import type { ShellType } from "../types/index.js";

export function inferShellType(shellPath: string | undefined): ShellType {
  if (!shellPath) {
    return "unknown";
  }

  const shellName = path.basename(shellPath).toLowerCase();

  if (shellName.includes("zsh")) {
    return "zsh";
  }

  if (shellName.includes("bash")) {
    return "bash";
  }

  if (shellName === "sh" || shellName.endsWith("/sh")) {
    return "sh";
  }

  return "unknown";
}

export function detectShell(shellPath = process.env.SHELL): ShellType {
  return inferShellType(shellPath);
}
