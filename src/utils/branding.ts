export const APP_NAME = "AI-CMD";
export const APP_VERSION = "1.0.4";
export const BRAND_NAME = "Ottili ONE";
export const BRAND_URL = "ottili.one";

export function formatVersionBanner(): string {
  return [
    APP_NAME,
    `v. ${APP_VERSION}`,
    `Powered by ${BRAND_NAME}`,
    BRAND_URL
  ].join("\n");
}

export function formatReplBanner(): string {
  return `${APP_NAME} | Powered by ${BRAND_NAME} | ${BRAND_URL}`;
}
