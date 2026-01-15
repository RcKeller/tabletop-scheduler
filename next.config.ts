import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack configuration
  turbopack: {
    // Increase memory limit for better performance
    memoryLimit: 4000,
  },
  // Disable persistent caching to avoid stale cache issues
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
