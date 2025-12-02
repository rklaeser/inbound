import type { Metadata } from "next";
import "./globals.css";
import { DeveloperModeProvider } from "@/lib/DeveloperModeContext";
import { ThemeProvider } from "next-themes";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export const metadata: Metadata = {
  title: "Inbound",
  description: "Automated lead qualification and response system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <DeveloperModeProvider>
            {children}
          </DeveloperModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
