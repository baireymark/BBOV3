import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

// Exposes Cloudflare bindings (e.g. WORKER_SELF_REFERENCE) to `next dev`.
initOpenNextCloudflareForDev();
