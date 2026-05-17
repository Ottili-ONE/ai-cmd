export const APP_NAME = "AI-CMD";
export const APP_VERSION = "1.0.4";
export const BRAND_NAME = "Ottili ONE";
export const BRAND_URL = "ottili.one";

export function formatVersionBanner(): string {
  // A slightly more polished, but still plain-text banner that preserves
  // the original tokens so tests and integrations that look for them keep
  // working.
  const title = `${APP_NAME}  v. ${APP_VERSION}`;
  const powered = `Powered by ${BRAND_NAME} — ${BRAND_URL}`;

  const width = Math.max(title.length, powered.length) + 4;
  const pad = (s: string) => `│ ${s}${" ".repeat(width - s.length - 3)}│`;

  return [
    `┌${"─".repeat(width - 2)}┐`,
    pad(title),
    pad(powered),
    `└${"─".repeat(width - 2)}┘`
  ].join("\n");
}

export function formatReplBanner(): string {
  // Friendly single-line banner for the REPL that still includes the
  // brand tokens expected by tests.
  return `${APP_NAME} — Powered by ${BRAND_NAME} (${BRAND_URL})`;
}
