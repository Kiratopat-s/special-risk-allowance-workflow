import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  deploymentId: process.env.DEPLOYMENT_VERSION || undefined,
  env: {
    NEXT_PUBLIC_DEPLOYMENT_VERSION: process.env.DEPLOYMENT_VERSION || "",
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
