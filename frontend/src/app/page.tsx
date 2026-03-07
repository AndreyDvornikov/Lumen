import dynamic from "next/dynamic";

const CampaignMap = dynamic(
  () => import("@/components/CampaignMap").then((mod) => mod.CampaignMap),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <section className="space-y-4 rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-8 shadow-lg shadow-cyan-900/20">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Lumen Protocol</p>
        <h1 className="text-4xl font-semibold">Campaign Operations Portal</h1>
        <p className="max-w-2xl text-slate-300">
          Manage factions, coordinate missions, and stream live table events with a realtime backend powered by FastAPI and WebSockets.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-medium">Realtime Session Feed</h2>
          <p className="mt-2 text-sm text-slate-300">WebSocket channel for GM announcements and player actions.</p>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-medium">Persistent Lore Vault</h2>
          <p className="mt-2 text-sm text-slate-300">PostgreSQL-backed records for campaigns, NPCs, and artifacts.</p>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-medium">Fast Caching Layer</h2>
          <p className="mt-2 text-sm text-slate-300">Redis pub/sub and caching for high-velocity game state updates.</p>
        </article>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Campaign Map</h2>
        <CampaignMap />
      </section>
    </main>
  );
}
