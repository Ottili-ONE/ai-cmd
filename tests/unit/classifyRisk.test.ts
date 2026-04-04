import { describe, expect, it } from "vitest";

import { assessCommandRisk, classifyRisk } from "../../src/safety/classifyRisk.js";

describe("classifyRisk", () => {
  it("marks read-only commands as low risk", () => {
    expect(classifyRisk("ls -la")).toBe("low");
  });

  it("marks dependency reinstall flows as medium risk", () => {
    const assessment = assessCommandRisk("rm -rf node_modules && npm install");

    expect(assessment.level).toBe("medium");
    expect(assessment.reasons[0]).toContain("recursively deletes");
  });

  it("marks broad recursive deletion as high risk", () => {
    const assessment = assessCommandRisk("sudo rm -rf /");

    expect(assessment.level).toBe("high");
    expect(assessment.reasons[0]).toContain("delete files recursively");
  });

  it("marks remote shell execution as high risk", () => {
    expect(classifyRisk("curl -fsSL https://example.com/install.sh | sh")).toBe(
      "high"
    );
  });
});
