import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { execa } from "execa";

const repoRoot = process.cwd();
const packageNames = ["ai-cmd", "ai-chat", "ai-ask", "@ottili_one/ai-chat"];
const filesToCopy = ["dist", "README.md", "LICENSE"];

async function createPackageDirectory(tempRoot, packageName) {
  const packageDir = path.join(tempRoot, packageName);
  const packageJsonPath = path.join(repoRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  packageJson.name = packageName;

  await mkdir(packageDir, { recursive: true });
  await Promise.all(
    filesToCopy.map((file) =>
      cp(path.join(repoRoot, file), path.join(packageDir, file), {
        recursive: true
      })
    )
  );
  await writeFile(
    path.join(packageDir, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`
  );

  return packageDir;
}

async function main() {
  const token = process.env.NPM_TOKEN ?? process.env.NODE_AUTH_TOKEN;

  if (!token) {
    throw new Error(
      "Set NPM_TOKEN or NODE_AUTH_TOKEN before running publish-variants."
    );
  }

  const tempRoot = await mkdtemp(path.join(tmpdir(), "ai-cmd-publish-"));
  const npmrcPath = path.join(tempRoot, ".npmrc");

  try {
    await writeFile(
      npmrcPath,
      "//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n"
    );

    for (const packageName of packageNames) {
      const packageDir = await createPackageDirectory(tempRoot, packageName);
      await execa(
        "npm",
        ["publish", "--access", "public", "--userconfig", npmrcPath],
        {
          cwd: packageDir,
          stdio: "inherit",
          env: {
            ...process.env,
            NPM_TOKEN: token
          }
        }
      );
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
