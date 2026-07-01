import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "새김",
    short_name: "새김",
    description: "새김은 좋은 문장을 카드로 기록하고 발견하며, 마음에 남는 글을 비공개 서랍에 간직하는 모바일 웹 서비스입니다.",
    start_url: "/discover",
    display: "standalone",
    background_color: "#F6F5F6",
    theme_color: "#F6F5F6",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
