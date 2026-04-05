import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const IGNORED_NAMES = new Set([
  ".git",
  ".idea",
  ".vscode",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".turbo"
]);

type WorkspaceSummary = {
  topLevelEntries: string[];
  treePreview: string[];
  projectHints: string[];
  packageJson?: {
    name?: string;
    packageManager?: string;
    scripts?: string[];
    dependencies?: string[];
  };
  makeTargets?: string[];
  cargoPackage?: string;
  goModule?: string;
  docker?: string[];
};

async function listTree(
  root: string,
  currentDir: string,
  depth: number,
  limit: { remaining: number }
): Promise<string[]> {
  if (depth < 0 || limit.remaining <= 0) {
    return [];
  }

  let entries;

  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const visibleEntries = entries
    .filter((entry) => !IGNORED_NAMES.has(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  const preview: string[] = [];

  for (const entry of visibleEntries) {
    if (limit.remaining <= 0) {
      break;
    }

    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(root, absolutePath) || entry.name;
    preview.push(entry.isDirectory() ? `${relativePath}/` : relativePath);
    limit.remaining -= 1;

    if (entry.isDirectory() && depth > 0 && limit.remaining > 0) {
      preview.push(...(await listTree(root, absolutePath, depth - 1, limit)));
    }
  }

  return preview;
}

function parsePackageJson(rawText: string): WorkspaceSummary["packageJson"] {
  try {
    const parsed = JSON.parse(rawText) as {
      name?: string;
      packageManager?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const dependencies = [
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {})
    ].slice(0, 10);

    return {
      ...(parsed.name ? { name: parsed.name } : {}),
      ...(parsed.packageManager
        ? { packageManager: parsed.packageManager }
        : {}),
      scripts: Object.keys(parsed.scripts ?? {}).slice(0, 10),
      dependencies
    };
  } catch {
    return undefined;
  }
}

function parseMakeTargets(rawText: string): string[] {
  return rawText
    .split(/\r?\n/u)
    .map((line) => line.match(/^([A-Za-z0-9][^:\s=]+):(?:\s|$)/u)?.[1])
    .filter((target): target is string => Boolean(target))
    .filter((target) => !target.startsWith("."))
    .slice(0, 10);
}

function parseCargoPackage(rawText: string): string | undefined {
  const match = rawText.match(/^\s*name\s*=\s*"([^"]+)"/mu);
  return match?.[1];
}

function parseGoModule(rawText: string): string | undefined {
  const match = rawText.match(/^module\s+(.+)$/mu);
  return match?.[1]?.trim();
}

function parseDockerServices(rawText: string): string[] {
  const servicesBlock = rawText.match(/^\s*services:\s*([\s\S]+)$/mu)?.[1];

  if (!servicesBlock) {
    return [];
  }

  return Array.from(servicesBlock.matchAll(/^\s{2}([A-Za-z0-9._-]+):\s*$/gmu))
    .map((match) => match[1])
    .filter((service): service is string => Boolean(service))
    .slice(0, 10);
}

export async function inspectWorkspace(
  cwd: string
): Promise<string | undefined> {
  let topLevelEntries;

  try {
    topLevelEntries = await readdir(cwd, { withFileTypes: true });
  } catch {
    return undefined;
  }

  const visibleTopLevelEntries = topLevelEntries
    .filter((entry) => !IGNORED_NAMES.has(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));

  const summary: WorkspaceSummary = {
    topLevelEntries: visibleTopLevelEntries
      .slice(0, 20)
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name)),
    treePreview: await listTree(cwd, cwd, 1, { remaining: 25 }),
    projectHints: []
  };

  const fileReaders: Array<Promise<void>> = [];

  const maybeReadFile = (
    fileName: string,
    onContent: (value: string) => void
  ) => {
    if (!visibleTopLevelEntries.some((entry) => entry.name === fileName)) {
      return;
    }

    fileReaders.push(
      readFile(path.join(cwd, fileName), "utf8")
        .then(onContent)
        .catch(() => undefined)
    );
  };

  if (visibleTopLevelEntries.some((entry) => entry.name === "package.json")) {
    summary.projectHints.push("node");
  }

  if (
    visibleTopLevelEntries.some((entry) =>
      [
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yml",
        "compose.yaml"
      ].includes(entry.name)
    )
  ) {
    summary.projectHints.push("docker-compose");
  }

  if (visibleTopLevelEntries.some((entry) => entry.name === "Dockerfile")) {
    summary.projectHints.push("docker");
  }

  if (visibleTopLevelEntries.some((entry) => entry.name === "Cargo.toml")) {
    summary.projectHints.push("rust");
  }

  if (visibleTopLevelEntries.some((entry) => entry.name === "go.mod")) {
    summary.projectHints.push("go");
  }

  if (visibleTopLevelEntries.some((entry) => entry.name === "pyproject.toml")) {
    summary.projectHints.push("python");
  }

  maybeReadFile("package.json", (rawText) => {
    const packageJson = parsePackageJson(rawText);

    if (packageJson) {
      summary.packageJson = packageJson;
    }
  });
  maybeReadFile("Makefile", (rawText) => {
    summary.makeTargets = parseMakeTargets(rawText);
  });
  maybeReadFile("Cargo.toml", (rawText) => {
    const cargoPackage = parseCargoPackage(rawText);

    if (cargoPackage) {
      summary.cargoPackage = cargoPackage;
    }
  });
  maybeReadFile("go.mod", (rawText) => {
    const goModule = parseGoModule(rawText);

    if (goModule) {
      summary.goModule = goModule;
    }
  });

  for (const composeFile of [
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml"
  ]) {
    maybeReadFile(composeFile, (rawText) => {
      summary.docker = parseDockerServices(rawText);
    });
  }

  await Promise.all(fileReaders);

  return JSON.stringify(summary, null, 2);
}
