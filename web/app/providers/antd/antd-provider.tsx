"use client";

import { ConfigProvider, theme } from "antd";
import { useTheme } from "next-themes";

interface Props {
  children: React.ReactNode;
}

export function AntdProvider({ children }: Props) {
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,

        token: {
          colorPrimary: "#4462ff",

          colorBgBase: isDark ? "#1e1f28" : "#ffffff",

          colorText: isDark ? "#ffffff" : "#101010",

          borderRadius: 18,

          fontFamily: "var(--font-apercu)",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
