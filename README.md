# `ai-cmd`

![GitHub stars](https://img.shields.io/github/stars/Ottili-ONE/ai-cmd)
![License](https://img.shields.io/github/license/Ottili-ONE/ai-cmd)
![npm version](https://img.shields.io/npm/v/ai-cmd)
![Downloads](https://img.shields.io/npm/dm/ai-cmd)

`ai-cmd` is a focused CLI for turning natural-language terminal questions into a single shell command you can inspect, copy, explain, and optionally run with confirmation.

It is designed for the fast path:

```bash
ai "how do I restart nginx"
```

Instead of a chatty assistant or a full autonomous agent, `ai-cmd` aims to be the small utility you keep installed because it is quick, predictable, and useful.

## Why it exists

Developers regularly know what they want to do in the terminal, but not the exact command for the current machine, shell, or init system.

`ai-cmd` narrows that gap by:

- generating one best command instead of a long essay
- adapting to Linux, macOS, WSL, and generic Unix-like environments
- explaining what the command does
- classifying command risk before execution
- keeping interactive follow-ups lightweight

## Powered by Ottili ONE

This project is part of the **Ottili ONE ecosystem** — a modular AI system for automating development, business workflows, and operations.

### Website: https://ottili.one

---

## Features

- One-shot command generation: `ai "<question>"`
- Interactive REPL mode: `ai`
- Session-aware follow-up questions in REPL mode
- Command explanations and platform notes
- Clipboard copy support
- Optional execution with confirmation
- Heuristic risk classification for destructive commands
- Configurable provider abstraction for OpenAI, Ollama, and vLLM
- JSON mode for scripting

## Installation

### Global install from npm

```bash
npm install -g ai-cmd
```

### Local development install

```bash
npm install
npm run build
npm link
```

## Configuration

`ai-cmd` reads configuration from environment variables and optionally from `~/.ai-cmd/config.json`.

Environment variables take precedence over the config file.

If OpenAI is selected and no API key is configured yet, `ai-cmd` creates a starter config file for you on first run.

### OpenAI

OpenAI remains the default provider:

```bash
export AI_API_KEY="your-api-key"
export AI_PROVIDER="openai"
export AI_MODEL="gpt-5.4-mini"
export AI_BASE_URL="https://api.openai.com/v1"
export AI_TIMEOUT_MS="30000"
```

### Ollama

Use a local Ollama model such as Gemma:

```bash
export AI_PROVIDER="ollama"
export AI_MODEL="gemma3:4b"
export AI_BASE_URL="http://localhost:11434/api"
```

No API key is required for the default local Ollama setup.

### vLLM

Use a local or self-hosted OpenAI-compatible vLLM server:

```bash
export AI_PROVIDER="vllm"
export AI_MODEL="google/gemma-3-4b-it"
export AI_BASE_URL="http://localhost:8000/v1"
```

No API key is required for a local vLLM server unless you configured auth yourself.

### Example config file

`~/.ai-cmd/config.json`

```json
{
  "provider": "openai",
  "model": "gpt-5.4-mini",
  "apiKey": "your-api-key",
  "baseUrl": "https://api.openai.com/v1",
  "timeoutMs": 30000
}
```

If OpenAI configuration is missing, `ai-cmd` fails clearly:

```text
Missing AI_API_KEY. Set it in your environment or edit ~/.ai-cmd/config.json. A starter config has been created if it did not already exist.
```

## Usage

### One-shot mode

```bash
ai "how do I restart nginx"
ai "find all files bigger than 100MB"
ai "show disk usage" --json
ai "remove node_modules and reinstall packages" --exec
ai "find all jpg files" --copy
```

### Interactive mode

```bash
ai
```

Commands available inside the REPL:

- `help`
- `last`
- `explain`
- `run`
- `copy`
- `clear`
- `exit`

Example session:

```text
ai-cmd > how do I restart nginx
ai-cmd > explain
ai-cmd > run
```

## CLI flags

- `--version` Show the branded version banner
- `--exec` Execute the generated command after confirmation
- `--yes` Skip the normal confirmation step for low and medium risk commands
- `--explain` Explicitly request explanation details from the provider
- `--json` Output machine-readable JSON
- `--shell <bash|zsh|sh>` Hint the active shell
- `--copy` Copy the generated command to the clipboard
- `--no-color` Disable colored output
- `--debug` Print diagnostic context

## Safety model

`ai-cmd` is allowed to execute commands, so the MVP includes a practical safety layer:

- `low` risk: read-only or status-style commands such as `ls -la`
- `medium` risk: service restarts, dependency installs, project-scoped cleanup
- `high` risk: destructive recursive deletes, disk tools, remote shell pipes, system package removal

Execution rules:

- low and medium risk commands require confirmation unless `--yes` is used
- high risk commands always require an explicit confirmation phrase
- `--yes` never bypasses the high-risk confirmation path
- unsupported host OSes can still generate best-effort Unix-style commands, but execution is disabled

Example high-risk confirmation:

```text
Risk: HIGH
This command can delete files recursively outside the current project.
Type EXECUTE HIGH RISK COMMAND to continue:
```

## Supported platforms

- Linux
- macOS
- WSL
- Generic Unix-like systems

Notes:

- Linux service-manager detection prefers `systemctl`, then `service`, then `rc-service`
- macOS service handling prefers launchd-oriented commands
- Native Windows command generation is intentionally limited in this MVP

## Architecture

```text
src/
  cli/
  config/
  core/
  exec/
  platform/
  providers/
  safety/
  types/
  utils/
tests/
  integration/
  unit/
```

Key design choices:

- thin Commander-based CLI layer
- business logic isolated under `core/`
- provider abstraction isolated under `providers/`
- platform and service-manager detection isolated under `platform/`
- execution safety and confirmation logic isolated under `safety/`
- strict JSON normalization and validation before rendering or execution

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Run in development mode:

```bash
npm run dev -- "how do I list listening ports"
```

## JSON output

`--json` prints a structured payload suitable for scripts:

```bash
ai "show disk usage" --json
```

Example shape:

```json
{
  "question": "show disk usage",
  "command": "du -sh .",
  "explanation": "Shows total disk usage for the current directory.",
  "risk": "low",
  "platformNotes": [],
  "assumptions": [],
  "platform": {
    "os": "linux",
    "shell": "bash",
    "serviceManager": "systemctl",
    "cwd": "/work/project",
    "cwdName": "project"
  }
}
```

## Roadmap

- richer shell support
- more precise filesystem-aware risk detection
- Homebrew distribution
- optional standalone binaries
- improved follow-up context handling

## License

MIT
