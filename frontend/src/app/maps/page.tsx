"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, resolveApiAsset } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

type PlayerMap = {
  id: number;
  name: string;
  image_url: string;
  width: number;
  height: number;
  is_visible_to_players: boolean;
  created_by_id: number;
};

type PlayerMapLayer = {
  id: number;
  map_id: number;
  name: string;
  order_index: number;
  is_visible_to_players: boolean;
};

type PlayerMapElement = {
  id: number;
  layer_id: number;
  type: string;
  x: number;
  y: number;
  data: Record<string, unknown>;
  is_visible_to_players: boolean;
};

type Point = [number, number];

const MARKER_CATEGORY_COLORS: Record<string, string> = {
  city: "#38bdf8",
  danger: "#ef4444",
  quest: "#facc15",
  object: "#34d399",
  custom: "#f45a3c",
};

function getPointsFromData(data: Record<string, unknown>): Point[] {
  const rawPoints = Array.isArray(data.points)
    ? data.points
    : Array.isArray(data.polygon)
    ? data.polygon
    : [];

  return rawPoints
    .map((value) => {
      if (!Array.isArray(value) || value.length < 2) return null;
      const x = Number(value[0]);
      const y = Number(value[1]);
      if (Number.isNaN(x) || Number.isNaN(y)) return null;
      return [x, y] as Point;
    })
    .filter((point): point is Point => point !== null);
}

export default function MapsPage() {
  const router = useRouter();

  const [maps, setMaps] = useState<PlayerMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [selectedMap, setSelectedMap] = useState<PlayerMap | null>(null);

  const [layers, setLayers] = useState<PlayerMapLayer[]>([]);
  const [elementsByLayerId, setElementsByLayerId] = useState<
    Record<number, PlayerMapElement[]>
  >({});

  const [visibleLayerIds, setVisibleLayerIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function loadMaps() {
      setLoading(true);

      try {
        const mapList = await apiFetch<PlayerMap[]>("/maps");
        if (cancelled) return;

        setMaps(mapList);
        setSelectedMapId(mapList[0]?.id ?? null);
      } catch (err) {
        if (err instanceof Error && err.message.includes("401")) {
          logout();
          router.replace("/login");
          return;
        }

        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load maps");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMaps();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!selectedMapId) return;

    let cancelled = false;

    async function loadMap() {
      setLoading(true);

      try {
        const mapData = await apiFetch<PlayerMap>(`/maps/${selectedMapId}`);
        const layerData = await apiFetch<PlayerMapLayer[]>(
          `/maps/${selectedMapId}/layers`
        );

        const layerElements = await Promise.all(
          layerData.map(async (layer) => ({
            layerId: layer.id,
            elements: await apiFetch<PlayerMapElement[]>(
              `/maps/layers/${layer.id}/elements`
            ),
          }))
        );

        if (cancelled) return;

        setSelectedMap(mapData);
        setLayers(layerData);
        setVisibleLayerIds(layerData.map((l) => l.id));

        setElementsByLayerId(
          Object.fromEntries(layerElements.map((e) => [e.layerId, e.elements]))
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load map");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMap();

    return () => {
      cancelled = true;
    };
  }, [selectedMapId]);

  const visibleElements = useMemo(
    () =>
      layers
        .filter((l) => visibleLayerIds.includes(l.id))
        .flatMap((l) => elementsByLayerId[l.id] ?? []),
    [layers, elementsByLayerId, visibleLayerIds]
  );

  function toggleLayer(layerId: number) {
    setVisibleLayerIds((current) =>
      current.includes(layerId)
        ? current.filter((id) => id !== layerId)
        : [...current, layerId]
    );
  }

  function elementStyle(element: PlayerMapElement): CSSProperties {
    if (!selectedMap) return {};

    return {
      left: `${(element.x / selectedMap.width) * 100}%`,
      top: `${(element.y / selectedMap.height) * 100}%`,
    };
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-6 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
          <div>
            <select
              value={selectedMapId ?? ""}
              onChange={(e) => setSelectedMapId(Number(e.target.value))}
              className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100"
            >
              {maps.map((map) => (
                <option key={map.id} value={map.id}>
                  {map.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h2 className="text-lg text-slate-100 mb-2">Layers</h2>
            {layers.map((layer) => (
              <label
                key={layer.id}
                className="flex items-center gap-3 text-sm text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={visibleLayerIds.includes(layer.id)}
                  onChange={() => toggleLayer(layer.id)}
                />
                {layer.name}
              </label>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
          {selectedMap && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-slate-100">
                {selectedMap.name}
              </h2>

              <div className="relative overflow-hidden rounded-2xl border border-lumen-dark bg-black/20">
                <div
                  className="relative w-full overflow-hidden"
                  style={{
                    aspectRatio: `${selectedMap.width} / ${selectedMap.height}`,
                  }}
                >
                  <img
                    src={resolveApiAsset(selectedMap.image_url)}
                    alt={selectedMap.name}
                    className="absolute inset-0 w-full h-full object-contain select-none"
                    draggable={false}
                  />

                  <svg
                    viewBox={`0 0 ${selectedMap.width} ${selectedMap.height}`}
                    className="absolute inset-0 w-full h-full"
                    preserveAspectRatio="none"
                  >
                    {visibleElements.map((element) => {
                      const points = getPointsFromData(element.data);
                      const color =
                        typeof element.data.color === "string"
                          ? element.data.color
                          : "#F45A3C";

                      if (element.type === "area" && points.length >= 3) {
                        const centerX =
                          points.reduce((sum, p) => sum + p[0], 0) / points.length;
                        const centerY =
                          points.reduce((sum, p) => sum + p[1], 0) / points.length;
                        const name =
                          typeof element.data.name === "string"
                            ? element.data.name
                            : "";
                        const areaFontSize = Math.max(selectedMap.height * 0.03, 32);

                        return (
                          <g key={element.id}>
                            <polygon
                              points={points.map((p) => p.join(",")).join(" ")}
                              fill={color}
                              fillOpacity={
                                typeof element.data.opacity === "number" ? element.data.opacity : 0.3
                              }
                              stroke={color}
                              strokeWidth={
                                typeof element.data.border_width === "number" ? element.data.border_width : 3
                              }
                            />

                            {name && (
                              <text
                                x={centerX}
                                y={centerY}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="white"
                                fontSize={areaFontSize}
                                fontWeight="bold"
                                stroke="black"
                                strokeWidth={6}
                                paintOrder="stroke"
                              >
                                {name}
                              </text>
                            )}
                          </g>
                        );
                      }

                      if (element.type === "drawing" && points.length >= 2) {
                        return (
                          <polyline
                            key={element.id}
                            points={points.map((p) => p.join(",")).join(" ")}
                            fill="none"
                            stroke={color}
                            strokeOpacity={
                              typeof element.data.opacity === "number" ? element.data.opacity : 0.85
                            }
                            strokeWidth={
                              typeof element.data.brush_size === "number" ? element.data.brush_size : 4
                            }
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        );
                      }

                      if (element.type === "text") {
                        const text =
                          typeof element.data.text === "string" ? element.data.text : "";
                        if (!text) {
                          return null;
                        }

                        const fontSize =
                          typeof element.data.font_size === "number"
                            ? element.data.font_size
                            : typeof element.data.fontSize === "number"
                              ? element.data.fontSize
                              : 20;
                        const textColor =
                          typeof element.data.color === "string" ? element.data.color : "#ffffff";

                        return (
                          <text
                            key={element.id}
                            x={element.x}
                            y={element.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={fontSize}
                            fontWeight="700"
                            fill={textColor}
                            stroke="black"
                            strokeWidth={3}
                            paintOrder="stroke"
                          >
                            {text}
                          </text>
                        );
                      }

                      return null;
                    })}
                  </svg>

                  {visibleElements.map((element) => {
                    if (element.type !== "marker") return null;

                    const label =
                      typeof element.data.label === "string"
                        ? element.data.label
                        : "marker";

                    const markerSize =
                      typeof element.data.marker_size === "number"
                        ? element.data.marker_size
                        : 12;

                    const category =
                      typeof element.data.category === "string"
                        ? element.data.category
                        : "custom";

                    return (
                      <div
                        key={element.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={elementStyle(element)}
                        title={label}
                      >
                        <div
                          style={{
                            width: markerSize,
                            height: markerSize,
                            borderRadius: "50%",
                            background:
                              MARKER_CATEGORY_COLORS[category] ??
                              MARKER_CATEGORY_COLORS.custom,
                            border: "2px solid black",
                          }}
                        />

                        <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
