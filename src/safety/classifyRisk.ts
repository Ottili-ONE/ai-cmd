import { parse as parseShellCommand } from "shell-quote";

import { HIGH_RISK_RULES, MEDIUM_RISK_RULES } from "./dangerousPatterns.js";
import type { RiskLevel } from "../types/index.js";

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
}

const SAFE_DELETE_TARGETS = new Set([
  "node_modules",
  "./node_modules",
  "dist",
  "./dist",
  "build",
  "./build",
  ".turbo",
  "./.turbo",
  ".next",
  "./.next",
  "coverage",
  "./coverage"
]);

function tokenizeCommand(command: string): string[] {
  return parseShellCommand(command)
    .filter((part): part is string => typeof part === "string")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function assessRecursiveDelete(command: string): RiskAssessment | undefined {
  if (!/\brm\b/i.test(command) || !/-[^\s]*r/i.test(command) || !/-[^\s]*f/i.test(command)) {
    return undefined;
  }

  const rmSegment = command
    .split(/\s*(?:&&|\|\||;|\|)\s*/)
    .find((segment) => /\brm\b/i.test(segment));

  if (!rmSegment) {
    return undefined;
  }

  const tokens = tokenizeCommand(rmSegment);
  const rmIndex = tokens.findIndex((token) => token === "rm" || token.endsWith("/rm"));

  if (rmIndex === -1) {
    return undefined;
  }

  const targets: string[] = [];

  for (const token of tokens.slice(rmIndex + 1)) {
    if (token.startsWith("-")) {
      continue;
    }

    targets.push(token);
  }

  if (targets.length === 0) {
    return {
      level: "high",
      reasons: ["This recursive delete command does not clearly scope its targets."]
    };
  }

  if (
    targets.some((target) =>
      [
        "/",
        "/*",
        "~",
        "~/",
        ".",
        "./",
        "..",
        "../"
      ].includes(target)
    ) ||
    targets.some((target) => target.startsWith("/") || target.startsWith("~")) ||
    targets.some((target) => target.includes("..")) ||
    targets.some((target) => target.includes("*"))
  ) {
    return {
      level: "high",
      reasons: [
        "This command can delete files recursively outside the current project."
      ]
    };
  }

  if (targets.every((target) => SAFE_DELETE_TARGETS.has(target))) {
    return {
      level: "medium",
      reasons: ["This command recursively deletes common project build artifacts."]
    };
  }

  return {
    level: "high",
    reasons: ["This command recursively deletes directories with a broad target scope."]
  };
}

export function assessCommandRisk(command: string): RiskAssessment {
  const reasons: string[] = [];
  const recursiveDeleteRisk = assessRecursiveDelete(command);

  if (recursiveDeleteRisk?.level === "high") {
    return recursiveDeleteRisk;
  }

  for (const rule of HIGH_RISK_RULES) {
    if (rule.pattern.test(command)) {
      reasons.push(rule.reason);
    }
  }

  if (reasons.length > 0) {
    return {
      level: "high",
      reasons
    };
  }

  if (recursiveDeleteRisk?.level === "medium") {
    reasons.push(...recursiveDeleteRisk.reasons);
  }

  for (const rule of MEDIUM_RISK_RULES) {
    if (rule.pattern.test(command)) {
      reasons.push(rule.reason);
    }
  }

  return {
    level: reasons.length > 0 ? "medium" : "low",
    reasons
  };
}

export function classifyRisk(command: string): RiskLevel {
  return assessCommandRisk(command).level;
}
