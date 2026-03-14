"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";

type LoginResponse = {
  access_token: string;
  token_type: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getToken()) {
      router.replace("/maps");
    }
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        withAuth: false,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setToken(data.access_token);
      router.replace("/maps");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <section className="space-y-6 rounded-2xl border border-lumen-dark bg-lumen-bg p-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-lumen-accent">Lumen Protocol</p>
          <h1 className="text-2xl font-semibold">Portal Login</h1>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-2 text-sm">
            <span className="text-slate-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-lumen-dark bg-lumen-bg px-3 py-2 outline-none ring-lumen-mid focus:ring-2"
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span className="text-slate-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-lumen-dark bg-lumen-bg px-3 py-2 outline-none ring-lumen-mid focus:ring-2"
            />
          </label>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-lumen-mid px-4 py-2 font-semibold text-white transition hover:bg-lumen-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Entering..." : "Enter Portal"}
          </button>
        </form>

        <Link href="/" className="text-sm text-gray-300 hover:text-lumen-accent">
          Back to home
        </Link>
      </section>
    </main>
  );
}
