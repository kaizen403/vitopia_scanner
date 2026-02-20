import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: "/home/kaizen/opus-fest",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vitopia.vitap.ac.in",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
