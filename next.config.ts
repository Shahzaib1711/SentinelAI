import type { NextConfig } from "next";

const fastApiUrl = process.env.FASTAPI_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // WebRTC hooks maintain long-lived peer connections; strict mode double-mount breaks them in dev.
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${fastApiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
