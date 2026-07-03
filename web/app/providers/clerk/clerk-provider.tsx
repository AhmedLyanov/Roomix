"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

interface Props {
  children: React.ReactNode;
}

export function AppClerkProvider({ children }: Props) {
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  return (
    <ClerkProvider
      appearance={{
        baseTheme: isDark ? dark : undefined,

        variables: {
          colorPrimary: "#4462ff",

          colorBackground: isDark ? "#1e1f28" : "#ffffff",

          colorText: isDark ? "#ffffff" : "#1e1f28",

          colorTextSecondary: "#9193a9",

          colorInputBackground: isDark ? "#272933" : "#f6f8ff",

          colorInputText: isDark ? "#ffffff" : "#1e1f28",

          colorDanger: "#ff616a",

          borderRadius: "18px",

          fontFamily: "var(--font-apercu)",
        },

        elements: {
          card:
            "shadow-none border rounded-[28px] bg-[var(--color-background)] border-[var(--color-border-strong)]",

          headerTitle:
            "text-[32px] font-semibold text-[var(--color-foreground)]",

          headerSubtitle:
            "text-[var(--color-gray-light)]",

          formFieldLabel:
            "text-[var(--color-gray-light)]",

          formFieldInput:
            "h-[54px] rounded-[18px]",

          formButtonPrimary:
            "h-[54px] rounded-[18px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]",

          socialButtonsBlockButton:
            "h-[54px] rounded-[18px]",

          footerActionLink:
            "text-[var(--color-accent)]",

          dividerLine:
            "bg-[var(--color-border-strong)]",

          dividerText:
            "text-[var(--color-gray-light)]",

          footer:
            "bg-transparent",

          navbar:
            "hidden",

          /*
           * АВАТАР 45x45
           */

          userButtonTrigger:
            "!w-[45px] !h-[45px] overflow-hidden rounded-full",

          userButtonAvatarBox:
            "!w-[45px] !h-[45px]",

          userButtonBox:
            "!w-[45px] !h-[45px]",

          avatarBox:
            "!w-[45px] !h-[45px]",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}