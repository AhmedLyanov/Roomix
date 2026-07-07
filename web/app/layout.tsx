import type { Metadata } from "next";

import { apercu, lato } from "@/public/fonts";

import { ThemeProvider } from "@/app/providers/theme/theme-provider";
import { QueryProvider } from "@/shared/provider/query-provider";
import { AppClerkProvider } from "@/app/providers/clerk/clerk-provider";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://merriweather.app"),

  title: {
    default: "Merriweather",
    template: "%s | Merriweather",
  },

  description:
    "Merriweather is a modern platform for online meetings, virtual classrooms, debates, and collaborative video conferencing.",

  keywords: [
    "video conferencing",
    "online meetings",
    "virtual classroom",
    "education platform",
    "online learning",
    "web conferencing",
    "video calls",
    "remote collaboration",
    "debates",
    "meetings platform",
    "Merriweather",
  ],

  authors: [
    {
      name: "Ahmad-al-Lyiany",
    },
  ],

  creator: "Ahmad-al-Lyiany",

  openGraph: {
    title: "Merriweather",
    description:
      "Modern platform for online meetings, virtual classrooms, debates, and collaborative video conferencing.",
    url: "https://merriweather.app",
    siteName: "Merriweather",
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Merriweather",
    description:
      "Modern platform for online meetings, virtual classrooms, debates, and collaborative video conferencing.",
  },

  robots: {
    index: true,
    follow: true,
  },

  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${apercu.variable} ${lato.variable} h-full antialiased`}
    >
      <body className="h-full">
        <ThemeProvider attribute="class" enableSystem>
          <QueryProvider>
            <AppClerkProvider>{children}</AppClerkProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
