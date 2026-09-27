/** Fixed diagnostics only: never include configuration values or parser errors. */
export const emailWorkerConfigurationMessages = {
  EMAIL_HOST_REQUIRED: "EMAIL_HOST is required.",
  EMAIL_HOST_INVALID: "EMAIL_HOST must be an SMTP hostname without whitespace.",
  EMAIL_USER_REQUIRED: "EMAIL_USER is required.",
  EMAIL_PASS_REQUIRED: "EMAIL_PASS is required.",
  EMAIL_PORT_INVALID: "EMAIL_PORT must be an integer from 1 to 65535, or blank to use 587.",
  EMAIL_FROM_INVALID: "EMAIL_FROM must contain one valid sender address without line breaks, or be blank to use the default.",
  NEXTAUTH_URL_REQUIRED: "NEXTAUTH_URL is required.",
  NEXTAUTH_URL_INVALID: "NEXTAUTH_URL must be an absolute HTTP(S) URL without embedded credentials, a query or a fragment.",
  NEXTAUTH_URL_HTTPS_REQUIRED: "NEXTAUTH_URL must use HTTPS when NODE_ENV=production, including UAT Docker deployments.",
  DATABASE_URL_REQUIRED: "DATABASE_URL is required.",
  DATABASE_URL_INVALID: "DATABASE_URL must be an absolute postgres:// or postgresql:// URL with a hostname.",
} as const;

export type EmailWorkerConfigurationIssue = keyof typeof emailWorkerConfigurationMessages;

export class EmailWorkerConfigurationError extends Error {
  constructor(
    readonly issues: readonly EmailWorkerConfigurationIssue[],
    code: "EMAIL_CONFIGURATION_INVALID" | "DATABASE_CONFIGURATION_INVALID" | "WORKER_CONFIGURATION_INVALID",
  ) {
    super(code);
    this.name = "EmailWorkerConfigurationError";
  }
}
