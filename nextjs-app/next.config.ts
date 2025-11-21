import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
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
