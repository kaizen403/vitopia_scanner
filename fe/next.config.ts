import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "praana.pims.ac.in",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
