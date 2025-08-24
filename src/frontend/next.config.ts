import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'export',
  distDir: '.next/build',
  trailingSlash: false,      
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@declarations': path.resolve(__dirname, './declarations'),
    };
    return config;
  },
};

export default nextConfig;
