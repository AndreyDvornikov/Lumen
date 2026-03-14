"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { AuthUser } from "@/components/wiki/types";
import { apiFetch } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

type GMPlayer = {
  id: number;
  email: string;
  username: string;
  role: "gm" | "player";
  created_at: string;
};

type CreatePlayerFormState = {
  username: string;
  email: string;
  password: string;
};

const DEFAULT_CREATE_PLAYER_FORM: CreatePlayerFormState = {
  username: "",
  email: "",
  password: "",
};

export default function GmPlayersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [players, setPlayers] = useState<GMPlayer[]>([]);
  const [form, setForm] = useState<CreatePlayerFormState>(DEFAULT_CREATE_PLAYER_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const user = await apiFetch<AuthUser>("/auth/me");
      if (user.role !== "gm") {
        router.replace("/wiki");
        return;
      }
      setCurrentUser(user);

      const playersData = await apiFetch<GMPlayer[]>("/gm/users");
      setPlayers(playersData);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        logout();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load players");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void loadPlayers();
  }, [loadPlayers, router]);

  async function createPlayer() {
    setSubmitting(true);
    setError(null);

    try {
      await apiFetch<GMPlayer>("/gm/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm(DEFAULT_CREATE_PLAYER_FORM);
      await loadPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create player");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-6 py-8 text-slate-300">Loading GM players...</main>;
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-lumen-accent">GM Panel</p>
        <h1 className="text-3xl font-semibold text-slate-100">Players</h1>
        <p className="text-sm text-slate-300">
          {currentUser ? `Signed in as ${currentUser.username}` : "Manage player accounts."}
        </p>
      </header>

      <div>
        <Link href="/gm/wiki" className="text-sm text-slate-300 transition hover:text-lumen-accent">
          Back to GM wiki
        </Link>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="space-y-4 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <h2 className="text-xl font-semibold text-slate-100">Create Player</h2>

        <input
          value={form.username}
          onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
          placeholder="Username"
          className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
        />
        <input
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          placeholder="Email"
          type="email"
          className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
        />
        <input
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          placeholder="Password"
          type="password"
          className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
        />

        <button
          type="button"
          onClick={() => void createPlayer()}
          disabled={submitting}
          className="rounded-xl bg-lumen-mid px-4 py-2 font-semibold text-white transition hover:bg-lumen-accent disabled:opacity-60"
        >
          Create Player
        </button>
      </section>

      <section className="space-y-4 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <h2 className="text-xl font-semibold text-slate-100">Player List</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-lumen-dark text-sm uppercase tracking-[0.12em] text-slate-400">
                <th className="px-3 py-3">Username</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-b border-lumen-dark/60 text-sm text-slate-200">
                  <td className="px-3 py-3">{player.username}</td>
                  <td className="px-3 py-3">{player.email}</td>
                  <td className="px-3 py-3">{player.role}</td>
                  <td className="px-3 py-3">{new Date(player.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
