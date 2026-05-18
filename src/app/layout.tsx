import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmashQueue - スマブラ大会フリー対戦管理",
  description: "スマブラ大会のフリー対戦台を管理し、募集・マッチング・順番待ち・呼び出し通知を一括で行うWebアプリ",
  applicationName: "SmashQueue",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SmashQueue",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><Providers>{children}</Providers></body>
    </html>
  );
}
