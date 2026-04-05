import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { inspectWorkspace } from "../../src/workspace/inspectWorkspace.js";

const tempPaths: string[] = [];

async function makeWorkspace(): Promise<string> {
  const workspacePath = await mkdtemp(path.join(tmpdir(), "ai-cmd-workspace-"));
  tempPaths.push(workspacePath);
  return workspacePath;
}

afterEach(async () => {
  await Promise.all(
    tempPaths
      .splice(0)
      .map((entry) => rm(entry, { recursive: true, force: true }))
  );
});

describe("inspectWorkspace", () => {
  it("summarizes common project files for prompt context", async () => {
    const workspacePath = await makeWorkspace();

    await mkdir(path.join(workspacePath, "src"));
    await writeFile(
      path.join(workspacePath, "package.json"),
      JSON.stringify({
        name: "demo-project",
        scripts: {
          build: "tsc",
          test: "vitest"
        },
        dependencies: {
          react: "^19.0.0"
        }
      }),
      "utf8"
    );
    await writeFile(
      path.join(workspacePath, "Makefile"),
      "build:\n\t@echo build\n",
      "utf8"
    );
    await writeFile(
      path.join(workspacePath, "src", "index.ts"),
      "console.log('hi');\n",
      "utf8"
    );

    const summary = await inspectWorkspace(workspacePath);

    expect(summary).toContain("demo-project");
    expect(summary).toContain('"projectHints": [');
    expect(summary).toContain("package.json");
    expect(summary).toContain("build");
    expect(summary).toContain("src/index.ts");
  });
});
