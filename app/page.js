"use client";
import dynamic from "next/dynamic";

const GrantManagerV2 = dynamic(() => import("@/components/GrantManagerV2"), { ssr: false });

export default function Home() {
  return <GrantManagerV2 />;
}