import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.GTV_E2E === "1" ? { distDir: ".next-e2e" } : {}),
};

export default nextConfig;
