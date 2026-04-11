import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "scontent.**" },
    ],
  },
  async rewrites() {
    return [
      { source: "/brands", destination: "/competitors" },
      { source: "/brands/:path*", destination: "/competitors/:path*" },
    ];
  },
};

export default nextConfig;
