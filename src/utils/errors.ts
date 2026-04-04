export class AiCmdError extends Error {
  readonly code: string;

  public constructor(code: string, message: string, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class ConfigurationError extends AiCmdError {
  public constructor(message: string, cause?: unknown) {
    super("CONFIG_ERROR", message, cause);
  }
}

export class ProviderError extends AiCmdError {
  public constructor(message: string, cause?: unknown) {
    super("PROVIDER_ERROR", message, cause);
  }
}

export class ResponseValidationError extends AiCmdError {
  public constructor(message: string, cause?: unknown) {
    super("RESPONSE_VALIDATION_ERROR", message, cause);
  }
}

export class ExecutionPolicyError extends AiCmdError {
  public constructor(message: string, cause?: unknown) {
    super("EXECUTION_POLICY_ERROR", message, cause);
  }
}

export class ExecutionError extends AiCmdError {
  public constructor(message: string, cause?: unknown) {
    super("EXECUTION_ERROR", message, cause);
  }
}

export class ClipboardError extends AiCmdError {
  public constructor(message: string, cause?: unknown) {
    super("CLIPBOARD_ERROR", message, cause);
  }
}

export class UserCancelledError extends AiCmdError {
  public constructor(message = "Operation cancelled by user.") {
    super("USER_CANCELLED", message);
  }
}

export function getErrorMessage(error: unknown, debug = false): string {
  if (error instanceof AiCmdError) {
    if (debug && error.cause) {
      return `${error.message}\nCause: ${String(error.cause)}`;
    }

    return error.message;
  }

  if (error instanceof Error) {
    if (debug && error.stack) {
      return error.stack;
    }

    return error.message;
  }

  return String(error);
}
