import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: "@storybook/nextjs",
  staticDirs: ["../public"],

  webpackFinal: async (config) => {
    const fileLoaderRule = config.module?.rules?.find(
      (rule) =>
        rule &&
        typeof rule === "object" &&
        "test" in rule &&
        rule.test instanceof RegExp &&
        rule.test.test(".svg"),
    );

    if (fileLoaderRule && typeof fileLoaderRule === "object") {
      fileLoaderRule.exclude = /\.svg$/;
    }

    config.module?.rules?.push({
      test: /\.svg$/,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    });

    return config;
  },
};

export default config;
