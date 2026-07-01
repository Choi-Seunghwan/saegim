import type { Metadata } from "next";
import { SaegimShell } from "../../src/components/SaegimShell";

export const metadata: Metadata = {
  title: "발견 | 새김",
  robots: {
    index: false,
    follow: true,
  },
};

export default function DiscoverPage() {
  return <SaegimShell />;
}
