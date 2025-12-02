import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vercel.com',
        pathname: '/api/www/avatar/**',
      },
    ],
  },
  serverExternalPackages: [
    'firebase-admin',
    '@google-cloud/firestore'
  ],
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push({
      'firebase-admin': 'commonjs firebase-admin',
      '@google-cloud/firestore': 'commonjs @google-cloud/firestore',
      'exa-js': 'commonjs exa-js',
    });
    return config;
  },
};

export default withWorkflow(nextConfig);
