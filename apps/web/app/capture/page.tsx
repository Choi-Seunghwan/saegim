import type { Metadata } from "next";
import { SaegimShell } from "../../src/components/SaegimShell";

export const metadata: Metadata = {
  title: "포착 | 새김",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CapturePage() {
  return <SaegimShell />;
}
