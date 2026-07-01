import type { Metadata } from "next";
import { SaegimShell } from "../../../src/components/SaegimShell";

export const metadata: Metadata = {
  title: "글 | 새김",
  robots: {
    index: false,
    follow: true,
  },
};

export default function PostAppPage() {
  return <SaegimShell />;
}
