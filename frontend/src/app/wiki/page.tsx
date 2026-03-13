"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getToken } from "@/lib/auth";

export default function WikiPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl flex-col gap-3 px-6 py-8">
      <h1 className="text-3xl font-semibold text-lumen-accent">Wiki</h1>
      <p className="text-gray-300">This section will contain discovered lore entries.</p>
    </main>
  );
}
