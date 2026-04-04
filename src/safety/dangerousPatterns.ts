import type { RiskLevel } from "../types/index.js";

export interface RiskRule {
  risk: RiskLevel;
  pattern: RegExp;
  reason: string;
}

export const HIGH_RISK_RULES: RiskRule[] = [
  {
    risk: "high",
    pattern: /\b(?:curl|wget)\b[\s\S]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/i,
    reason: "This command downloads remote content and executes it in a shell."
  },
  {
    risk: "high",
    pattern: /\b(?:dd|mkfs(?:\.\w+)?|fdisk|parted)\b/i,
    reason: "This command can modify or erase disks."
  },
  {
    risk: "high",
    pattern: /\bchmod\s+-R\s+777\s+\//i,
    reason: "This command recursively grants unsafe permissions at the filesystem root."
  },
  {
    risk: "high",
    pattern: /\bgit\s+reset\s+--hard\b/i,
    reason: "This command can permanently discard uncommitted changes."
  },
  {
    risk: "high",
    pattern:
      /\b(?:apt(?:-get)?|yum|dnf|pacman|apk|zypper)\s+(?:purge|remove|autoremove)\b/i,
    reason: "This command removes system packages and can affect system stability."
  },
  {
    risk: "high",
    pattern: /\b(?:userdel|groupdel|deluser)\b/i,
    reason: "This command removes system accounts."
  }
];

export const MEDIUM_RISK_RULES: RiskRule[] = [
  {
    risk: "medium",
    pattern: /\b(?:systemctl|service|rc-service)\s+(?:restart|stop)\b/i,
    reason: "This command changes the state of a system service."
  },
  {
    risk: "medium",
    pattern: /\b(?:launchctl\s+(?:stop|kickstart)|brew\s+services\s+(?:stop|restart))\b/i,
    reason: "This command changes the state of a macOS service."
  },
  {
    risk: "medium",
    pattern: /\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|update|upgrade|remove|uninstall)\b/i,
    reason: "This command changes project dependencies."
  },
  {
    risk: "medium",
    pattern: /\bdocker\s+compose\s+down\b/i,
    reason: "This command stops and removes running containers."
  },
  {
    risk: "medium",
    pattern: /\b(?:kill|killall|pkill)\b/i,
    reason: "This command stops running processes."
  },
  {
    risk: "medium",
    pattern: /\b(?:reboot|shutdown)\b/i,
    reason: "This command disrupts the current system session."
  },
  {
    risk: "medium",
    pattern: /\bgit\s+clean\s+-f/i,
    reason: "This command removes untracked files from the repository."
  }
];
