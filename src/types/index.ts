export type RiskLevel = "low" | "medium" | "high";
export type OperatingSystem =
  | "linux"
  | "macos"
  | "wsl"
  | "unix"
  | "unsupported";
export type ShellType = "bash" | "zsh" | "sh" | "unknown";
export type ServiceManager =
  | "systemctl"
  | "service"
  | "rc-service"
  | "launchctl"
  | "unknown";
export type ProviderName =
  | "openai"
  | "anthropic"
  | "ollama"
  | "google"
  | "vllm";

export interface PlatformContext {
  os: OperatingSystem;
  shell: ShellType;
  serviceManager: ServiceManager;
  cwd: string;
  cwdName: string;
}

export interface ProviderCommandPayload {
  command: string;
  explanation: string;
  platformNotes?: string[];
  assumptions?: string[];
}

export interface ConversationTurn {
  question: string;
  command: string;
  explanation: string;
}

export interface CommandSuggestion extends ProviderCommandPayload {
  question: string;
  risk: RiskLevel;
  platform: PlatformContext;
}

export interface AppConfig {
  provider: ProviderName;
  model: string;
  apiKey?: string;
  baseUrl: string;
  timeoutMs: number;
  analytics: boolean;
  analyticsId?: string;
}

export interface GenerateObjectRequest {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schemaDescription: string;
  jsonSchema: Record<string, unknown>;
  temperature?: number;
}

export interface ProviderTextResponse {
  provider: string;
  model: string;
  rawText: string;
}

export interface AIProvider {
  readonly name: ProviderName;
  generateObject(input: GenerateObjectRequest): Promise<ProviderTextResponse>;
}

export interface GenerateCommandOptions {
  question: string;
  platform: PlatformContext;
  provider: AIProvider;
  explainRequested?: boolean;
  history?: ConversationTurn[];
  workspaceContext?: string;
}

export interface OutputOptions {
  color: boolean;
  explain: boolean;
  json: boolean;
}

export interface CliOptions {
  exec: boolean;
  yes: boolean;
  explain: boolean;
  json: boolean;
  version: boolean;
  shell?: Exclude<ShellType, "unknown">;
  noColor: boolean;
  debug: boolean;
  copy: boolean;
}

export interface PromptAdapter {
  confirm(message: string, initial?: boolean): Promise<boolean>;
  text(message: string): Promise<string>;
}

export interface AnalyticsClient {
  trackCliStart(payload: {
    os: string;
    shell: string;
    provider: ProviderName;
    mode: "interactive" | "one-shot";
  }): Promise<void>;
  trackPromptSent(payload: {
    os: string;
    shell: string;
    provider: ProviderName;
    mode: "interactive" | "one-shot";
  }): Promise<void>;
  trackError(payload: {
    prompt?: string;
    os?: string;
    shell?: string;
    provider?: ProviderName;
    message: string;
    code?: string;
    time: string;
  }): Promise<void>;
}
