// next.config.ts embeds this value into both bundles; runtime env cannot replace it.
export const DEPLOYMENT_VERSION = process.env.NEXT_PUBLIC_DEPLOYMENT_VERSION ?? "";
