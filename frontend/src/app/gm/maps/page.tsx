"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ImageInput } from "@/components/ui/ImageInput";
import type { AuthUser } from "@/components/wiki/types";
import { apiFetch } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

type GMMap = {
  id: number;
  name: string;
  image_url: string;
  width: number;
  height: number;
  is_visible_to_players: boolean;
  created_by_id: number;
  created_at: string;
};

type GMMapLayer = {
  id: number;
  map_id: number;
  name: string;
  order_index: number;
  is_visible_to_players: boolean;
};

type CreateMapForm = {
  name: string;
  image_url: string;
  width: string;
  height: string;
  is_visible_to_players: boolean;
};

type CreateLayerForm = {
  map_id: string;
  name: string;
  order_index: string;
  is_visible_to_players: boolean;
};

const DEFAULT_MAP_FORM: CreateMapForm = {
  name: "",
  image_url: "",
  width: "4096",
  height: "4096",
  is_visible_to_players: false,
};

const DEFAULT_LAYER_FORM: CreateLayerForm = {
  map_id: "",
  name: "",
  order_index: "0",
  is_visible_to_players: false,
};

export default function GmMapsPage() {
  const router = useRouter();
  const [maps, setMaps] = useState<GMMap[]>([]);
  const [layers, setLayers] = useState<Record<number, GMMapLayer[]>>({});
  const [mapForm, setMapForm] = useState<CreateMapForm>(DEFAULT_MAP_FORM);
  const [layerForm, setLayerForm] = useState<CreateLayerForm>(DEFAULT_LAYER_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const user = await apiFetch<AuthUser>("/auth/me");
      if (user.role !== "gm") {
        router.replace("/wiki");
        return;
      }

      const mapData = await apiFetch<GMMap[]>("/gm/maps");
      const layerData = await Promise.all(
        mapData.map(async (map) => ({
          mapId: map.id,
          layers: await apiFetch<GMMapLayer[]>(`/gm/maps/${map.id}/layers`),
        }))
      );

      setMaps(mapData);
      setLayers(Object.fromEntries(layerData.map((item) => [item.mapId, item.layers])));
      setLayerForm((current) => ({
        ...current,
        map_id: current.map_id || String(mapData[0]?.id ?? ""),
      }));
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        logout();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load maps");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void loadData();
  }, [loadData, router]);

  async function createMap() {
    try {
      await apiFetch<GMMap>("/gm/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: mapForm.name,
          image_url: mapForm.image_url,
          width: Number(mapForm.width),
          height: Number(mapForm.height),
          is_visible_to_players: mapForm.is_visible_to_players,
        }),
      });
      setMapForm(DEFAULT_MAP_FORM);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create map");
    }
  }

  async function createLayer() {
    try {
      await apiFetch<GMMapLayer>(`/gm/maps/${layerForm.map_id}/layers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: layerForm.name,
          order_index: Number(layerForm.order_index),
          is_visible_to_players: layerForm.is_visible_to_players,
        }),
      });
      setLayerForm(DEFAULT_LAYER_FORM);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create layer");
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-6 py-8 text-slate-300">Loading GM maps...</main>;
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="space-y-2 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-lumen-accent">GM Panel</p>
        <h1 className="text-3xl font-semibold text-slate-100">Maps</h1>
      </header>

      <div>
        <Link href="/gm/wiki" className="text-sm text-slate-300 transition hover:text-lumen-accent">
          Back to GM wiki
        </Link>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
          <h2 className="text-xl font-semibold text-slate-100">Create Map</h2>
          <input
            value={mapForm.name}
            onChange={(event) => setMapForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Map name"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <ImageInput
            value={mapForm.image_url}
            onChange={(url) => setMapForm((current) => ({ ...current, image_url: url }))}
            label="Map image"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={mapForm.width}
              onChange={(event) => setMapForm((current) => ({ ...current, width: event.target.value }))}
              placeholder="Width"
              className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
            />
            <input
              value={mapForm.height}
              onChange={(event) => setMapForm((current) => ({ ...current, height: event.target.value }))}
              placeholder="Height"
              className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
            />
          </div>
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={mapForm.is_visible_to_players}
              onChange={(event) =>
                setMapForm((current) => ({ ...current, is_visible_to_players: event.target.checked }))
              }
              className="h-4 w-4 accent-[#F45A3C]"
            />
            Visible to players
          </label>
          <button
            type="button"
            onClick={() => void createMap()}
            className="rounded-xl bg-lumen-mid px-4 py-2 font-semibold text-white transition hover:bg-lumen-accent"
          >
            Create Map
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
          <h2 className="text-xl font-semibold text-slate-100">Create Layer</h2>
          <select
            value={layerForm.map_id}
            onChange={(event) => setLayerForm((current) => ({ ...current, map_id: event.target.value }))}
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          >
            <option value="">Select map</option>
            {maps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </select>
          <input
            value={layerForm.name}
            onChange={(event) => setLayerForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Layer name"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <input
            value={layerForm.order_index}
            onChange={(event) => setLayerForm((current) => ({ ...current, order_index: event.target.value }))}
            placeholder="Order index"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={layerForm.is_visible_to_players}
              onChange={(event) =>
                setLayerForm((current) => ({ ...current, is_visible_to_players: event.target.checked }))
              }
              className="h-4 w-4 accent-[#F45A3C]"
            />
            Visible to players
          </label>
          <button
            type="button"
            onClick={() => void createLayer()}
            className="rounded-xl bg-lumen-mid px-4 py-2 font-semibold text-white transition hover:bg-lumen-accent"
          >
            Create Layer
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <h2 className="text-xl font-semibold text-slate-100">Maps & Layers</h2>
        <div className="space-y-5">
          {maps.map((map) => (
            <div key={map.id} className="rounded-xl border border-lumen-dark p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-100">{map.name}</p>
                  <p className="text-sm text-slate-400">
                    {map.width} × {map.height} · {map.is_visible_to_players ? "Visible" : "Hidden"}
                  </p>
                </div>
                <Link
                  href={`/gm/maps/${map.id}`}
                  className="rounded-lg border border-lumen-mid px-3 py-1.5 text-sm font-semibold text-lumen-accent transition hover:bg-lumen-dark/20"
                >
                  Open editor
                </Link>
              </div>
              <div className="mt-4 space-y-2">
                {(layers[map.id] ?? []).map((layer) => (
                  <div key={layer.id} className="rounded-lg border border-lumen-dark/70 px-3 py-2 text-sm text-slate-200">
                    {layer.order_index}. {layer.name} · {layer.is_visible_to_players ? "Visible" : "Hidden"}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
