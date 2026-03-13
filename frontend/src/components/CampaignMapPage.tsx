"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ImageOverlay, MapContainer, Marker, Popup } from "react-leaflet";
import { useRouter, useSearchParams } from "next/navigation";

import { apiFetch, resolveApiAsset } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

type MarkerItem = {
  id: number;
  title: string;
  description: string | null;
  x: number;
  y: number;
  icon_type: string | null;
};

type CampaignMap = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  markers: MarkerItem[];
};

const MARKER_STYLES: Record<string, { color: string; glyph: string }> = {
  town: { color: "#22c55e", glyph: "T" },
  dungeon: { color: "#f97316", glyph: "D" },
  quest: { color: "#eab308", glyph: "Q" },
  enemy: { color: "#ef4444", glyph: "!" },
  npc: { color: "#38bdf8", glyph: "N" },
  treasure: { color: "#facc15", glyph: "$" },
};

function markerIcon(iconType: string | null): L.DivIcon {
  const style = MARKER_STYLES[iconType?.toLowerCase() ?? ""] ?? { color: "#F45A3C", glyph: "•" };
  const html = `
    <div style="
      width:28px;height:28px;border-radius:9999px;
      display:flex;align-items:center;justify-content:center;
      background:${style.color};border:2px solid #0f172a;color:#020617;
      font-weight:700;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,.35);">
      ${style.glyph}
    </div>
  `;
  return L.divIcon({ html, className: "", iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] });
}

export function CampaignMapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapId = Number(searchParams.get("mapId") ?? "1");

  const [data, setData] = useState<CampaignMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setIsAuthorized(true);
  }, [router]);

  useEffect(() => {
    if (!isAuthorized) {
      return;
    }

    let cancelled = false;

    async function loadMap() {
      setLoading(true);
      setError(null);

      try {
        const json = await apiFetch<CampaignMap>(`/maps/${mapId}`);
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof Error && err.message.includes("401")) {
            logout();
            router.replace("/login");
            return;
          }
          setError(err instanceof Error ? err.message : "Failed to load map");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMap();
    return () => {
      cancelled = true;
    };
  }, [isAuthorized, mapId, router]);

  const imageUrl = useMemo(() => {
    if (!data?.image_url) {
      return null;
    }
    return resolveApiAsset(data.image_url);
  }, [data?.image_url]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="space-y-2 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-lumen-accent">Campaign Map</p>
        <h1 className="text-2xl font-semibold">{data?.name ?? "Loading map..."}</h1>
        {data?.description ? <p className="text-sm text-slate-300">{data.description}</p> : null}
      </header>

      {loading ? <p className="text-sm text-slate-300">Loading map data...</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {!loading && !error && data && imageUrl ? (
        <section className="overflow-hidden rounded-2xl border border-lumen-dark bg-lumen-bg">
          <MapContainer
            crs={L.CRS.Simple}
            bounds={[
              [0, 0],
              [1, 1],
            ]}
            maxBounds={[
              [-0.2, -0.2],
              [1.2, 1.2],
            ]}
            minZoom={-2}
            maxZoom={2}
            zoom={0}
            className="h-[70vh] w-full"
          >
            <ImageOverlay
              url={imageUrl}
              bounds={[
                [0, 0],
                [1, 1],
              ]}
            />

            {data.markers.map((marker) => (
              <Marker key={marker.id} position={[1 - marker.y, marker.x]} icon={markerIcon(marker.icon_type)}>
                <Popup>
                  <div className="space-y-1">
                    <p className="font-semibold">{marker.title}</p>
                    <p className="text-sm">{marker.description ?? "No details yet."}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </section>
      ) : null}
    </main>
  );
}
