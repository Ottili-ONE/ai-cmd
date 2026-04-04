import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { execa } from "execa";

const repoRoot = process.cwd();

async function runVitest(cwd) {
  await execa(
    process.execPath,
    [path.join(cwd, "node_modules", "vitest", "vitest.mjs"), "run"],
    {
      cwd,
      stdio: "inherit"
    }
  );
}

async function runFromTempWorkspace() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "ai-cmd-vitest-"));
  const linkedRepo = path.join(tempRoot, "repo");

  try {
    await cp(repoRoot, linkedRepo, {
      recursive: true,
      filter: (sourcePath) => !sourcePath.includes(`${path.sep}.git${path.sep}`)
    });

    await runVitest(linkedRepo);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

if (process.platform === "win32") {
  await runFromTempWorkspace();
} else {
  await runVitest(repoRoot);
}
