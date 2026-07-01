import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "새김",
    short_name: "새김",
    description: "한 줄을 카드로 만들어, 발견하고, 마음에 새겨 간직하는 곳",
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
