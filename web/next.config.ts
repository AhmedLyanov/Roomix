import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.103"],
  output: "standalone",

  webpack(config) {
    const fileLoaderRule = config.module.rules.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (rule: any) => rule.test?.test?.(".svg"),
    );
    config.module.rules.push({
      ...fileLoaderRule,
      test: /\.svg$/i,
      resourceQuery: /url/,
    });

    config.module.rules.push({
      test: /\.svg$/i,
      issuer: fileLoaderRule.issuer,
      resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] },
      use: ["@svgr/webpack"],
    });

    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },
};

export default nextConfig;
