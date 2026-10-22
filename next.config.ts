import type { NextConfig } from "next";
const nextConfig: NextConfig = { poweredByHeader: false, outputFileTracingRoot: process.cwd(), experimental: { cpus: 1 } };
export default nextConfig;
