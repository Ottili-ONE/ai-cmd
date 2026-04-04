export class Logger {
  public constructor(private readonly enabled: boolean) {}

  public debug(message: string, data?: unknown): void {
    if (!this.enabled) {
      return;
    }

    const payload =
      data === undefined ? "" : ` ${JSON.stringify(data, null, 2)}`;
    process.stderr.write(`[debug] ${message}${payload}\n`);
  }
}
