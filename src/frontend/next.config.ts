import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  distDir: 'build',
  webpack: (config, { isServer }) => {
    // Add alias for declarations
    config.resolve.alias = {
      ...config.resolve.alias,
      '@declarations': path.resolve(__dirname, '../declarations'),
    };
    
    return config;
  },
};

export default nextConfig;
