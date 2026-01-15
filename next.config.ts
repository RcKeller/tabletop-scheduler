import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Logging configuration for development debugging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
