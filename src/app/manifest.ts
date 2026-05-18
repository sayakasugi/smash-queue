import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SmashQueue - スマブラ大会フリー対戦管理",
    short_name: "SmashQueue",
    description:
      "スマブラ大会のフリー対戦台を管理し、募集・マッチング・順番待ち・呼び出し通知を一括で行うWebアプリ",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a1a",
    theme_color: "#0a0a1a",
    lang: "ja",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
