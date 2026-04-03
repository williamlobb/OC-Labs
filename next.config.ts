import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // CoWork profile photos
      {
        protocol: "https",
        hostname: "cowork.theoc.ai",
      },
      // GitHub avatars (used on profile cards)
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
