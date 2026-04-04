import { describe, expect, it } from "vitest";

import { inferOperatingSystem } from "../../src/platform/detectPlatform.js";
import { detectServiceManager } from "../../src/platform/detectServiceManager.js";
import { inferShellType } from "../../src/platform/detectShell.js";

describe("platform detection helpers", () => {
  it("detects macOS", () => {
    expect(
      inferOperatingSystem({
        platform: "darwin"
      })
    ).toBe("macos");
  });

  it("detects WSL from Linux proc version", () => {
    expect(
      inferOperatingSystem({
        platform: "linux",
        procVersion: "Linux version 6.6.0-microsoft-standard-WSL2"
      })
    ).toBe("wsl");
  });

  it("detects generic unix from BSD platforms", () => {
    expect(
      inferOperatingSystem({
        platform: "freebsd"
      })
    ).toBe("unix");
  });

  it("detects shells from SHELL paths", () => {
    expect(inferShellType("/bin/bash")).toBe("bash");
    expect(inferShellType("/bin/zsh")).toBe("zsh");
    expect(inferShellType("/bin/sh")).toBe("sh");
  });

  it("picks the first available service manager", async () => {
    const serviceManager = await detectServiceManager("linux", async (command) =>
      Promise.resolve(command === "service")
    );

    expect(serviceManager).toBe("service");
  });
});
