import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
