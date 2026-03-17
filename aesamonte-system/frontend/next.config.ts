import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Ensure we strip any trailing slash from the env variable to prevent malformed URLs
    const backendUrl = (process.env.BACKEND_URL || "https://ae-samonte-system.onrender.com").replace(/\/$/, "");
    
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;