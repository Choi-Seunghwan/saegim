import type { Metadata } from "next";
import { SaegimShell } from "../../src/components/SaegimShell";

export const metadata: Metadata = {
  title: "나 | 새김",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MePage() {
  return <SaegimShell />;
}
