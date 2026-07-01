import type { Metadata } from "next";
import { SaegimShell } from "../../src/components/SaegimShell";

export const metadata: Metadata = {
  title: "둘러보기 | 새김",
  robots: {
    index: false,
    follow: true,
  },
};

export default function ShelfPage() {
  return <SaegimShell />;
}
