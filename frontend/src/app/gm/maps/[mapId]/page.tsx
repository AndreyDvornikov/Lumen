"use client";

import Link from "next/link";
import {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";

import type { AuthUser } from "@/components/wiki/types";
import { apiFetch, resolveApiAsset } from "@/lib/api";
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

type GMMapElement = {
  id: number;
  layer_id: number;
  type: "marker" | "text" | "area" | "drawing" | string;
  x: number;
  y: number;
  data: Record<string, unknown>;
  is_visible_to_players: boolean;
};

type EditorTool = "select" | "marker" | "text" | "area" | "drawing";
type Point = [number, number];

type MarkerDraft = {
  label: string;
  marker_size: number;
  category: string;
  visible_to_players: boolean;
};

type TextDraft = {
  text: string;
  font_size: number;
  color: string;
  visible_to_players: boolean;
};

type AreaDraft = {
  name: string;
  color: string;
  opacity: number;
  border_width: number;
  visible_to_players: boolean;
};

type DrawingDraft = {
  color: string;
  opacity: number;
  brush_size: number;
  visible_to_players: boolean;
};

type SelectedElementDraft = {
  label: string;
  marker_size: number;
  category: string;
  text: string;
  font_size: number;
  color: string;
  name: string;
  opacity: number;
  border_width: number;
  brush_size: number;
  visible_to_players: boolean;
};

type DragState = {
  elementId: number;
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

type PanState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type DrawingState = {
  pointerId: number;
  points: Point[];
};

const TOOLS: EditorTool[] = ["select", "marker", "text", "area", "drawing"];
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.15;
const MARKER_CATEGORY_COLORS: Record<string, string> = {
  city: "#38bdf8",
  danger: "#ef4444",
  quest: "#facc15",
  object: "#34d399",
  custom: "#f45a3c",
};

const DEFAULT_MARKER_DRAFT: MarkerDraft = {
  label: "New marker",
  marker_size: 12,
  category: "custom",
  visible_to_players: true,
};

const DEFAULT_TEXT_DRAFT: TextDraft = {
  text: "Label",
  font_size: 20,
  color: "#f8fafc",
  visible_to_players: true,
};

const DEFAULT_AREA_DRAFT: AreaDraft = {
  name: "Zone",
  color: "#ef4444",
  opacity: 0.3,
  border_width: 3,
  visible_to_players: true,
};

const DEFAULT_DRAWING_DRAFT: DrawingDraft = {
  color: "#38bdf8",
  opacity: 0.85,
  brush_size: 4,
  visible_to_players: true,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function getPointsFromData(data: Record<string, unknown>): Point[] {
  const rawPoints = Array.isArray(data.points)
    ? data.points
    : Array.isArray(data.polygon)
      ? data.polygon
      : [];

  return rawPoints
    .map((value) => {
      if (!Array.isArray(value) || value.length < 2) {
        return null;
      }
      const x = Number(value[0]);
      const y = Number(value[1]);
      if (Number.isNaN(x) || Number.isNaN(y)) {
        return null;
      }
      return [x, y] as Point;
    })
    .filter((point): point is Point => point !== null);
}

function colorForCategory(category: string) {
  return MARKER_CATEGORY_COLORS[category] ?? MARKER_CATEGORY_COLORS.custom;
}

function normalizeDraft(element: GMMapElement): SelectedElementDraft {
  return {
    label: typeof element.data.label === "string" ? element.data.label : "",
    marker_size:
      typeof element.data.marker_size === "number"
        ? element.data.marker_size
        : 12,
    category:
      typeof element.data.category === "string" ? element.data.category : "custom",
    text: typeof element.data.text === "string" ? element.data.text : "",
    font_size:
      typeof element.data.font_size === "number"
        ? element.data.font_size
        : typeof element.data.fontSize === "number"
          ? element.data.fontSize
          : 20,
    color: typeof element.data.color === "string" ? element.data.color : "#f8fafc",
    name: typeof element.data.name === "string" ? element.data.name : "",
    opacity:
      typeof element.data.opacity === "number" ? element.data.opacity : 0.6,
    border_width:
      typeof element.data.border_width === "number" ? element.data.border_width : 3,
    brush_size:
      typeof element.data.brush_size === "number" ? element.data.brush_size : 4,
    visible_to_players: element.is_visible_to_players,
  };
}

export default function GmMapEditorPage() {
  const params = useParams<{ mapId: string }>();
  const router = useRouter();
  const mapId = Number(params.mapId);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const elementsByLayerRef = useRef<Record<number, GMMapElement[]>>({});

  const [map, setMap] = useState<GMMap | null>(null);
  const [layers, setLayers] = useState<GMMapLayer[]>([]);
  const [elementsByLayerId, setElementsByLayerId] = useState<Record<number, GMMapElement[]>>({});
  const [visibleLayerIds, setVisibleLayerIds] = useState<number[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<number | null>(null);
  const [tool, setTool] = useState<EditorTool>("select");
  const [selectedElementId, setSelectedElementId] = useState<number | null>(null);
  const [selectedElementDraft, setSelectedElementDraft] = useState<SelectedElementDraft | null>(null);
  const [draftPolygonPoints, setDraftPolygonPoints] = useState<Point[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [markerDraft, setMarkerDraft] = useState<MarkerDraft>(DEFAULT_MARKER_DRAFT);
  const [textDraft, setTextDraft] = useState<TextDraft>(DEFAULT_TEXT_DRAFT);
  const [areaDraft, setAreaDraft] = useState<AreaDraft>(DEFAULT_AREA_DRAFT);
  const [drawingDraft, setDrawingDraft] = useState<DrawingDraft>(DEFAULT_DRAWING_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    elementsByLayerRef.current = elementsByLayerId;
  }, [elementsByLayerId]);

  const loadMapEditor = useCallback(async () => {
    if (!mapId || Number.isNaN(mapId)) {
      setError("Invalid map id");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = await apiFetch<AuthUser>("/auth/me");
      if (user.role !== "gm") {
        router.replace("/wiki");
        return;
      }

      const mapData = await apiFetch<GMMap>(`/gm/maps/${mapId}`);
      const layerData = await apiFetch<GMMapLayer[]>(`/gm/maps/${mapId}/layers`);
      const layerElements = await Promise.all(
        layerData.map(async (layer) => ({
          layerId: layer.id,
          elements: await apiFetch<GMMapElement[]>(`/gm/maps/layers/${layer.id}/elements`),
        }))
      );

      setMap(mapData);
      setLayers(layerData);
      setVisibleLayerIds((current) =>
        current.length > 0 ? current : layerData.map((layer) => layer.id)
      );
      setActiveLayerId((current) => current ?? layerData[0]?.id ?? null);
      setElementsByLayerId(
        Object.fromEntries(layerElements.map((entry) => [entry.layerId, entry.elements]))
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        logout();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load map editor");
    } finally {
      setLoading(false);
    }
  }, [mapId, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void loadMapEditor();
  }, [loadMapEditor, router]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === "Space") {
        setSpacePressed(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        setSpacePressed(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const sortedLayers = useMemo(
    () => [...layers].sort((a, b) => a.order_index - b.order_index || a.id - b.id),
    [layers]
  );

  const visibleElements = useMemo(
    () =>
      sortedLayers
        .filter((layer) => visibleLayerIds.includes(layer.id))
        .flatMap((layer) => elementsByLayerId[layer.id] ?? []),
    [elementsByLayerId, sortedLayers, visibleLayerIds]
  );

  const selectedElement = useMemo(
    () =>
      Object.values(elementsByLayerId)
        .flat()
        .find((element) => element.id === selectedElementId) ?? null,
    [elementsByLayerId, selectedElementId]
  );

  useEffect(() => {
    if (!selectedElement) {
      setSelectedElementDraft(null);
      return;
    }
    setSelectedElementDraft(normalizeDraft(selectedElement));
  }, [selectedElement]);

  function getViewportRect() {
    return viewportRef.current?.getBoundingClientRect() ?? null;
  }

  function screenPointToMapPoint(clientX: number, clientY: number): Point | null {

  if (!map) return null;

  const rect = stageRef.current?.getBoundingClientRect();
  if (!rect) return null;

  const stageX = clientX - rect.left;
  const stageY = clientY - rect.top;

  const localX = (stageX - pan.x) / zoom;
  const localY = (stageY - pan.y) / zoom;

  const mapX = (localX / rect.width) * map.width;
  const mapY = (localY / rect.height) * map.height;

  return [mapX, mapY];
}

  function eventToMapPoint(event: ReactMouseEvent<HTMLElement> | ReactPointerEvent<HTMLElement>) {
    return screenPointToMapPoint(event.clientX, event.clientY);
  }

  function mapPointToPercent(point: Point) {
    if (!map) {
      return { left: "0%", top: "0%" };
    }
    return {
      left: `${(point[0] / map.width) * 100}%`,
      top: `${(point[1] / map.height) * 100}%`,
    };
  }

  function absolutePosition(element: GMMapElement) {
    return mapPointToPercent([element.x, element.y]);
  }

  function elementFromState(elementId: number) {
    return Object.values(elementsByLayerRef.current)
      .flat()
      .find((item) => item.id === elementId);
  }

  function patchElementInState(updated: GMMapElement) {
    setElementsByLayerId((current) => {
      const next: Record<number, GMMapElement[]> = {};
      for (const [layerId, items] of Object.entries(current)) {
        const numericLayerId = Number(layerId);
        next[numericLayerId] = items.filter((item) => item.id !== updated.id);
      }
      next[updated.layer_id] = [...(next[updated.layer_id] ?? []), updated].sort((a, b) => a.id - b.id);
      return next;
    });
  }

  async function createElement(payload: {
    type: string;
    x: number;
    y: number;
    data: Record<string, unknown>;
    is_visible_to_players: boolean;
  }) {
    if (!activeLayerId) {
      setError("Select an active layer first");
      return;
    }

    try {
      const created = await apiFetch<GMMapElement>(`/gm/maps/layers/${activeLayerId}/elements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setElementsByLayerId((current) => ({
        ...current,
        [activeLayerId]: [...(current[activeLayerId] ?? []), created].sort((a, b) => a.id - b.id),
      }));
      setSelectedElementId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create element");
    }
  }

  async function updateElement(
    elementId: number,
    payload: Partial<Pick<GMMapElement, "x" | "y">> & {
      data?: Record<string, unknown>;
      is_visible_to_players?: boolean;
    }
  ) {
    const existing = elementFromState(elementId);
    if (!existing) {
      return;
    }

    try {
      const optimistic: GMMapElement = {
        ...existing,
        x: payload.x ?? existing.x,
        y: payload.y ?? existing.y,
        data: payload.data ?? existing.data,
        is_visible_to_players:
          payload.is_visible_to_players ?? existing.is_visible_to_players,
      };
      patchElementInState(optimistic);

      const updated = await apiFetch<GMMapElement>(`/gm/maps/elements/${elementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      patchElementInState(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update element");
      await loadMapEditor();
    }
  }

  async function deleteElement(elementId: number) {
    try {
      await apiFetch(`/gm/maps/elements/${elementId}`, { method: "DELETE" });
      setElementsByLayerId((current) =>
        Object.fromEntries(
          Object.entries(current).map(([layerId, items]) => [
            Number(layerId),
            items.filter((item) => item.id !== elementId),
          ])
        )
      );
      setSelectedElementId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete element");
    }
  }

  async function createLayer() {
    if (!map || !newLayerName.trim()) {
      return;
    }

    try {
      const created = await apiFetch<GMMapLayer>(`/gm/maps/${map.id}/layers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLayerName.trim(),
          order_index: sortedLayers.length,
          is_visible_to_players: true,
        }),
      });

      setLayers((current) => [...current, created]);
      setElementsByLayerId((current) => ({ ...current, [created.id]: [] }));
      setVisibleLayerIds((current) =>
        current.includes(created.id) ? current : [...current, created.id]
      );
      setActiveLayerId(created.id);
      setNewLayerName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create layer");
    }
  }

  async function updateLayer(layerId: number, payload: Partial<GMMapLayer>) {
    try {
      const updated = await apiFetch<GMMapLayer>(`/gm/maps/layers/${layerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setLayers((current) => current.map((layer) => (layer.id === layerId ? updated : layer)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update layer");
      await loadMapEditor();
    }
  }

  async function deleteLayer(layerId: number) {
    try {
      await apiFetch(`/gm/maps/layers/${layerId}`, { method: "DELETE" });
      setLayers((current) => current.filter((layer) => layer.id !== layerId));
      setElementsByLayerId((current) => {
        const next = { ...current };
        delete next[layerId];
        return next;
      });
      setVisibleLayerIds((current) => current.filter((id) => id !== layerId));
      setActiveLayerId((current) => (current === layerId ? null : current));
      setSelectedElementId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete layer");
    }
  }

  async function reorderLayer(layerId: number, direction: -1 | 1) {
    const index = sortedLayers.findIndex((layer) => layer.id === layerId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= sortedLayers.length) {
      return;
    }

    const currentLayer = sortedLayers[index];
    const targetLayer = sortedLayers[targetIndex];

    setLayers((current) =>
      current.map((layer) => {
        if (layer.id === currentLayer.id) {
          return { ...layer, order_index: targetLayer.order_index };
        }
        if (layer.id === targetLayer.id) {
          return { ...layer, order_index: currentLayer.order_index };
        }
        return layer;
      })
    );

    await Promise.all([
      updateLayer(currentLayer.id, { order_index: targetLayer.order_index }),
      updateLayer(targetLayer.id, { order_index: currentLayer.order_index }),
    ]);
  }

  function toggleEditorLayerVisibility(layerId: number) {
    setVisibleLayerIds((current) =>
      current.includes(layerId) ? current.filter((id) => id !== layerId) : [...current, layerId]
    );
  }

  function setToolAndReset(nextTool: EditorTool) {
    setTool(nextTool);
    setDraftPolygonPoints([]);
    setDrawingState(null);
    setDragState(null);
  }

  function handleMapClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!map || spacePressed) {
      return;
    }

    const coords = eventToMapPoint(event);
    if (!coords) {
      return;
    }

    if (tool === "marker") {
      void createElement({
        type: "marker",
        x: coords[0],
        y: coords[1],
        is_visible_to_players: markerDraft.visible_to_players,
        data: {
          label: markerDraft.label.trim() || "Marker",
          marker_size: markerDraft.marker_size,
          category: markerDraft.category,
        },
      });
      return;
    }

    if (tool === "text") {
      void createElement({
        type: "text",
        x: coords[0],
        y: coords[1],
        is_visible_to_players: textDraft.visible_to_players,
        data: {
          text: textDraft.text.trim() || "Label",
          font_size: textDraft.font_size,
          color: textDraft.color,
        },
      });
      return;
    }

    if (tool === "area") {
      setDraftPolygonPoints((current) => [...current, coords]);
      return;
    }

    if (tool === "select") {
      setSelectedElementId(null);
    }
  }

  async function finishAreaDraft(points: Point[]) {
    if (points.length < 3) {
      setDraftPolygonPoints(points);
      return;
    }

    const centerX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const centerY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    await createElement({
      type: "area",
      x: centerX,
      y: centerY,
      is_visible_to_players: areaDraft.visible_to_players,
      data: {
        points,
        polygon: points,
        name: areaDraft.name.trim() || "Zone",
        color: areaDraft.color,
        opacity: areaDraft.opacity,
        border_width: areaDraft.border_width,
      },
    });
    setDraftPolygonPoints([]);
  }

  function handleMapDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (tool !== "area") {
      return;
    }

    event.preventDefault();
    const coords = eventToMapPoint(event);
    if (!coords) {
      return;
    }

    const nextPoints = [...draftPolygonPoints];
    const lastPoint = nextPoints[nextPoints.length - 1];
    if (!lastPoint || distance(lastPoint, coords) > 4) {
      nextPoints.push(coords);
    }

    void finishAreaDraft(nextPoints);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();

    const rect = stageRef.current?.getBoundingClientRect() ?? null;
    if (!rect) {
      return;
    }

    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const localX = (cursorX - pan.x) / zoom;
    const localY = (cursorY - pan.y) / zoom;
    const nextZoom = clamp(
      zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP),
      ZOOM_MIN,
      ZOOM_MAX
    );

    setZoom(nextZoom);
    setPan({
      x: cursorX - localX * nextZoom,
      y: cursorY - localY * nextZoom,
    });
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    });
  }

  function beginElementDrag(event: ReactPointerEvent<HTMLDivElement>, elementId: number) {
    if (!selectedElement || selectedElement.id !== elementId) {
      setSelectedElementId(elementId);
    }

    const coords = eventToMapPoint(event);
    const element = elementFromState(elementId);
    if (!coords || !element) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      elementId,
      pointerId: event.pointerId,
      offsetX: coords[0] - element.x,
      offsetY: coords[1] - element.y,
    });
  }

  function beginDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    const coords = eventToMapPoint(event);
    if (!coords) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawingState({ pointerId: event.pointerId, points: [coords] });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!map) {
      return;
    }

    if (spacePressed || event.button === 1) {
      beginPan(event);
      return;
    }

    if (tool === "drawing") {
      beginDrawing(event);
      return;
    }

    if (tool === "select") {
      beginPan(event);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (panState && panState.pointerId === event.pointerId) {
      setPan({
        x: panState.originX + (event.clientX - panState.startX),
        y: panState.originY + (event.clientY - panState.startY),
      });
      return;
    }

    if (dragState && dragState.pointerId === event.pointerId && map) {
      const coords = eventToMapPoint(event);
      const element = elementFromState(dragState.elementId);
      if (!coords || !element) {
        return;
      }

      const nextX = clamp(coords[0] - dragState.offsetX, 0, map.width);
      const nextY = clamp(coords[1] - dragState.offsetY, 0, map.height);

      patchElementInState({ ...element, x: nextX, y: nextY });
      return;
    }

    if (drawingState && drawingState.pointerId === event.pointerId) {
      const coords = eventToMapPoint(event);
      if (!coords) {
        return;
      }

      setDrawingState((current) => {
        if (!current) {
          return current;
        }
        const lastPoint = current.points[current.points.length - 1];
        if (lastPoint && distance(lastPoint, coords) < 8) {
          return current;
        }
        return { ...current, points: [...current.points, coords] };
      });
    }
  }

  async function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (panState?.pointerId === event.pointerId) {
      setPanState(null);
    }

    if (dragState?.pointerId === event.pointerId) {
      const element = elementFromState(dragState.elementId);
      setDragState(null);
      if (element) {
        await updateElement(dragState.elementId, { x: element.x, y: element.y });
      }
    }

    if (drawingState?.pointerId === event.pointerId) {
      const points = drawingState.points;
      setDrawingState(null);
      if (points.length < 2) {
        return;
      }

      const centerX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
      const centerY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
      await createElement({
        type: "drawing",
        x: centerX,
        y: centerY,
        is_visible_to_players: drawingDraft.visible_to_players,
        data: {
          points,
          color: drawingDraft.color,
          opacity: drawingDraft.opacity,
          brush_size: drawingDraft.brush_size,
        },
      });
    }
  }

  async function saveSelectedElement() {
    if (!selectedElement || !selectedElementDraft) {
      return;
    }

    setSaving(true);
    try {
      if (selectedElement.type === "marker") {
        await updateElement(selectedElement.id, {
          is_visible_to_players: selectedElementDraft.visible_to_players,
          data: {
            ...selectedElement.data,
            label: selectedElementDraft.label.trim() || "Marker",
            marker_size: selectedElementDraft.marker_size,
            category: selectedElementDraft.category,
          },
        });
      } else if (selectedElement.type === "text") {
        await updateElement(selectedElement.id, {
          is_visible_to_players: selectedElementDraft.visible_to_players,
          data: {
            ...selectedElement.data,
            text: selectedElementDraft.text.trim() || "Label",
            font_size: selectedElementDraft.font_size,
            color: selectedElementDraft.color,
          },
        });
      } else if (selectedElement.type === "area") {
        await updateElement(selectedElement.id, {
          is_visible_to_players: selectedElementDraft.visible_to_players,
          data: {
            ...selectedElement.data,
            name: selectedElementDraft.name.trim() || "Zone",
            color: selectedElementDraft.color,
            opacity: selectedElementDraft.opacity,
            border_width: selectedElementDraft.border_width,
          },
        });
      } else if (selectedElement.type === "drawing") {
        await updateElement(selectedElement.id, {
          is_visible_to_players: selectedElementDraft.visible_to_players,
          data: {
            ...selectedElement.data,
            color: selectedElementDraft.color,
            opacity: selectedElementDraft.opacity,
            brush_size: selectedElementDraft.brush_size,
          },
        });
      }
    } finally {
      setSaving(false);
    }
  }

  function renderPropertyPanel() {
    if (selectedElement && selectedElementDraft) {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-lumen-dark bg-lumen-bg p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-lumen-accent">Selection</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-100">
              {selectedElement.type}
            </h2>
            <p className="mt-1 text-sm text-slate-400">Element #{selectedElement.id}</p>
          </div>

          <div className="space-y-3 rounded-2xl border border-lumen-dark bg-lumen-bg p-4 text-sm text-slate-200">
            {selectedElement.type === "marker" ? (
              <>
                <input
                  value={selectedElementDraft.label}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current ? { ...current, label: event.target.value } : current
                    )
                  }
                  placeholder="Marker label"
                  className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                />
                <input
                  type="number"
                  min={6}
                  max={48}
                  value={selectedElementDraft.marker_size}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current
                        ? { ...current, marker_size: Number(event.target.value) || 12 }
                        : current
                    )
                  }
                  className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                />
                <select
                  value={selectedElementDraft.category}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current ? { ...current, category: event.target.value } : current
                    )
                  }
                  className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                >
                  {Object.keys(MARKER_CATEGORY_COLORS).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            {selectedElement.type === "text" ? (
              <>
                <textarea
                  value={selectedElementDraft.text}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current ? { ...current, text: event.target.value } : current
                    )
                  }
                  rows={4}
                  className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                />
                <input
                  type="number"
                  min={10}
                  max={96}
                  value={selectedElementDraft.font_size}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current
                        ? { ...current, font_size: Number(event.target.value) || 20 }
                        : current
                    )
                  }
                  className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                />
                <input
                  type="color"
                  value={selectedElementDraft.color}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current ? { ...current, color: event.target.value } : current
                    )
                  }
                  className="h-12 w-full rounded-xl border border-lumen-dark bg-lumen-bg px-2 py-2"
                />
              </>
            ) : null}

            {selectedElement.type === "area" ? (
              <>
                <input
                  value={selectedElementDraft.name}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current ? { ...current, name: event.target.value } : current
                    )
                  }
                  placeholder="Zone name"
                  className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                />
                <input
                  type="color"
                  value={selectedElementDraft.color}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current ? { ...current, color: event.target.value } : current
                    )
                  }
                  className="h-12 w-full rounded-xl border border-lumen-dark bg-lumen-bg px-2 py-2"
                />
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={selectedElementDraft.opacity}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current ? { ...current, opacity: Number(event.target.value) } : current
                    )
                  }
                  className="w-full"
                />
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={selectedElementDraft.border_width}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current
                        ? { ...current, border_width: Number(event.target.value) || 3 }
                        : current
                    )
                  }
                  className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                />
              </>
            ) : null}

            {selectedElement.type === "drawing" ? (
              <>
                <input
                  type="color"
                  value={selectedElementDraft.color}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current ? { ...current, color: event.target.value } : current
                    )
                  }
                  className="h-12 w-full rounded-xl border border-lumen-dark bg-lumen-bg px-2 py-2"
                />
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={selectedElementDraft.opacity}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current ? { ...current, opacity: Number(event.target.value) } : current
                    )
                  }
                  className="w-full"
                />
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={selectedElementDraft.brush_size}
                  onChange={(event) =>
                    setSelectedElementDraft((current) =>
                      current
                        ? { ...current, brush_size: Number(event.target.value) || 4 }
                        : current
                    )
                  }
                  className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                />
              </>
            ) : null}

            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={selectedElementDraft.visible_to_players}
                onChange={(event) =>
                  setSelectedElementDraft((current) =>
                    current
                      ? { ...current, visible_to_players: event.target.checked }
                      : current
                  )
                }
                className="h-4 w-4 accent-[#F45A3C]"
              />
              Visible to players
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveSelectedElement()}
                disabled={saving}
                className="flex-1 rounded-xl bg-lumen-mid px-4 py-2 font-semibold text-white transition hover:bg-lumen-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => void deleteElement(selectedElement.id)}
                className="rounded-xl border border-rose-900 px-4 py-2 font-semibold text-rose-300 transition hover:bg-rose-950/40"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (tool === "marker") {
      return (
        <div className="space-y-4 rounded-2xl border border-lumen-dark bg-lumen-bg p-4">
          <h2 className="text-xl font-semibold text-slate-100">Marker Tool</h2>
          <input
            value={markerDraft.label}
            onChange={(event) =>
              setMarkerDraft((current) => ({ ...current, label: event.target.value }))
            }
            placeholder="Marker label"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <input
            type="number"
            min={6}
            max={48}
            value={markerDraft.marker_size}
            onChange={(event) =>
              setMarkerDraft((current) => ({
                ...current,
                marker_size: Number(event.target.value) || 12,
              }))
            }
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <select
            value={markerDraft.category}
            onChange={(event) =>
              setMarkerDraft((current) => ({ ...current, category: event.target.value }))
            }
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          >
            {Object.keys(MARKER_CATEGORY_COLORS).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={markerDraft.visible_to_players}
              onChange={(event) =>
                setMarkerDraft((current) => ({
                  ...current,
                  visible_to_players: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#F45A3C]"
            />
            Visible to players
          </label>
        </div>
      );
    }

    if (tool === "text") {
      return (
        <div className="space-y-4 rounded-2xl border border-lumen-dark bg-lumen-bg p-4">
          <h2 className="text-xl font-semibold text-slate-100">Text Tool</h2>
          <textarea
            value={textDraft.text}
            onChange={(event) =>
              setTextDraft((current) => ({ ...current, text: event.target.value }))
            }
            rows={4}
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <input
            type="number"
            min={10}
            max={96}
            value={textDraft.font_size}
            onChange={(event) =>
              setTextDraft((current) => ({
                ...current,
                font_size: Number(event.target.value) || 20,
              }))
            }
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <input
            type="color"
            value={textDraft.color}
            onChange={(event) =>
              setTextDraft((current) => ({ ...current, color: event.target.value }))
            }
            className="h-12 w-full rounded-xl border border-lumen-dark bg-lumen-bg px-2 py-2"
          />
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={textDraft.visible_to_players}
              onChange={(event) =>
                setTextDraft((current) => ({
                  ...current,
                  visible_to_players: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#F45A3C]"
            />
            Visible to players
          </label>
        </div>
      );
    }

    if (tool === "area") {
      return (
        <div className="space-y-4 rounded-2xl border border-lumen-dark bg-lumen-bg p-4">
          <h2 className="text-xl font-semibold text-slate-100">Area Tool</h2>
          <input
            value={areaDraft.name}
            onChange={(event) =>
              setAreaDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Area name"
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <input
            type="color"
            value={areaDraft.color}
            onChange={(event) =>
              setAreaDraft((current) => ({ ...current, color: event.target.value }))
            }
            className="h-12 w-full rounded-xl border border-lumen-dark bg-lumen-bg px-2 py-2"
          />
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={areaDraft.opacity}
            onChange={(event) =>
              setAreaDraft((current) => ({ ...current, opacity: Number(event.target.value) }))
            }
            className="w-full"
          />
          <input
            type="number"
            min={1}
            max={12}
            value={areaDraft.border_width}
            onChange={(event) =>
              setAreaDraft((current) => ({
                ...current,
                border_width: Number(event.target.value) || 3,
              }))
            }
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={areaDraft.visible_to_players}
              onChange={(event) =>
                setAreaDraft((current) => ({
                  ...current,
                  visible_to_players: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#F45A3C]"
            />
            Visible to players
          </label>
          {draftPolygonPoints.length > 0 ? (
            <p className="text-sm text-slate-400">
              Points: {draftPolygonPoints.length}. Double click the map to finish.
            </p>
          ) : null}
        </div>
      );
    }

    if (tool === "drawing") {
      return (
        <div className="space-y-4 rounded-2xl border border-lumen-dark bg-lumen-bg p-4">
          <h2 className="text-xl font-semibold text-slate-100">Drawing Tool</h2>
          <input
            type="color"
            value={drawingDraft.color}
            onChange={(event) =>
              setDrawingDraft((current) => ({ ...current, color: event.target.value }))
            }
            className="h-12 w-full rounded-xl border border-lumen-dark bg-lumen-bg px-2 py-2"
          />
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={drawingDraft.opacity}
            onChange={(event) =>
              setDrawingDraft((current) => ({
                ...current,
                opacity: Number(event.target.value),
              }))
            }
            className="w-full"
          />
          <input
            type="number"
            min={1}
            max={24}
            value={drawingDraft.brush_size}
            onChange={(event) =>
              setDrawingDraft((current) => ({
                ...current,
                brush_size: Number(event.target.value) || 4,
              }))
            }
            className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
          />
          <label className="flex items-center gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={drawingDraft.visible_to_players}
              onChange={(event) =>
                setDrawingDraft((current) => ({
                  ...current,
                  visible_to_players: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#F45A3C]"
            />
            Visible to players
          </label>
          <p className="text-sm text-slate-400">Press and drag to paint a stroke.</p>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-lumen-dark bg-lumen-bg p-4 text-sm text-slate-400">
        Select an element to edit its properties.
      </div>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 text-slate-300">
        Loading map editor...
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[1500px] flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/gm/maps"
          className="text-sm text-slate-300 transition hover:text-lumen-accent"
        >
          Back to GM maps
        </Link>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-lumen-dark bg-lumen-bg px-3 py-2">
          {TOOLS.map((editorTool) => (
            <button
              key={editorTool}
              type="button"
              onClick={() => setToolAndReset(editorTool)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                tool === editorTool
                  ? "bg-lumen-mid text-white"
                  : "border border-lumen-dark text-slate-200 hover:border-lumen-mid"
              }`}
            >
              {editorTool[0].toUpperCase() + editorTool.slice(1)}
            </button>
          ))}
          <div className="ml-2 flex items-center gap-2 border-l border-lumen-dark pl-3 text-sm text-slate-300">
            <button
              type="button"
              onClick={() => setZoom((current) => clamp(current - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
              className="rounded-lg border border-lumen-dark px-3 py-1.5 transition hover:border-lumen-mid"
            >
              -
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((current) => clamp(current + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
              className="rounded-lg border border-lumen-dark px-3 py-1.5 transition hover:border-lumen-mid"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="rounded-lg border border-lumen-dark px-3 py-1.5 transition hover:border-lumen-mid"
            >
              Reset view
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <aside className="space-y-5 rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-lumen-accent">GM Editor</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-100">{map?.name}</h1>
            <p className="mt-2 text-sm text-slate-400">
              Active layer:{" "}
              {sortedLayers.find((layer) => layer.id === activeLayerId)?.name ?? "None"}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-100">Layers</h2>
            <div className="flex gap-2">
              <input
                value={newLayerName}
                onChange={(event) => setNewLayerName(event.target.value)}
                placeholder="New layer name"
                className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
              />
              <button
                type="button"
                onClick={() => void createLayer()}
                className="rounded-xl bg-lumen-mid px-4 py-2 font-semibold text-white transition hover:bg-lumen-accent"
              >
                Add
              </button>
            </div>
            <div className="space-y-3">
              {sortedLayers.map((layer) => (
                <div key={layer.id} className="space-y-3 rounded-2xl border border-lumen-dark p-3">
                  <div className="flex items-start justify-between gap-2">
                    <input
                      value={layer.name}
                      onChange={(event) =>
                        setLayers((current) =>
                          current.map((item) =>
                            item.id === layer.id ? { ...item, name: event.target.value } : item
                          )
                        )
                      }
                      onBlur={(event) =>
                        void updateLayer(layer.id, { name: event.target.value.trim() || layer.name })
                      }
                      className="w-full rounded-lg border border-lumen-dark bg-lumen-bg px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-lumen-mid"
                    />
                    <button
                      type="button"
                      onClick={() => void deleteLayer(layer.id)}
                      className="rounded-lg border border-rose-900 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-950/40"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={visibleLayerIds.includes(layer.id)}
                        onChange={() => toggleEditorLayerVisibility(layer.id)}
                        className="h-4 w-4 accent-[#F45A3C]"
                      />
                      Show
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={layer.is_visible_to_players}
                        onChange={(event) =>
                          void updateLayer(layer.id, {
                            is_visible_to_players: event.target.checked,
                          })
                        }
                        className="h-4 w-4 accent-[#F45A3C]"
                      />
                      Players
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveLayerId(layer.id)}
                      className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                        activeLayerId === layer.id
                          ? "bg-lumen-mid text-white"
                          : "border border-lumen-dark hover:border-lumen-mid"
                      }`}
                    >
                      {activeLayerId === layer.id ? "Active" : "Set active"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reorderLayer(layer.id, -1)}
                      className="rounded-lg border border-lumen-dark px-3 py-1.5 transition hover:border-lumen-mid"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => void reorderLayer(layer.id, 1)}
                      className="rounded-lg border border-lumen-dark px-3 py-1.5 transition hover:border-lumen-mid"
                    >
                      Down
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="rounded-2xl border border-lumen-dark bg-lumen-bg p-5">
          {map ? (
            <div
              ref={viewportRef}
              className={`relative h-[75vh] overflow-hidden rounded-2xl border border-lumen-dark bg-black/30 ${
                spacePressed ? "cursor-grab" : tool === "select" ? "cursor-grab" : "cursor-crosshair"
              }`}
              onClick={handleMapClick}
              onDoubleClick={handleMapDoubleClick}
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => void handlePointerUp(event)}
              onPointerLeave={(event) => void handlePointerUp(event)}
            >
              <div
                ref={stageRef}
                className="absolute left-0 top-0 w-full origin-top-left"
                style={{
                  aspectRatio: `${map.width} / ${map.height}`,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              >
                <img
                  src={resolveApiAsset(map.image_url)}
                  alt={map.name}
                  className="block h-full w-full select-none object-contain"
                  draggable={false}
                />

                <svg
                  viewBox={`0 0 ${map.width} ${map.height}`}
                  className="absolute inset-0 h-full w-full"
                  preserveAspectRatio="none"
                >
                  {visibleElements.map((element) => {
                    const points = getPointsFromData(element.data);
                    if (element.type === "area" && points.length >= 3) {
                      const color =
                        typeof element.data.color === "string" ? element.data.color : "#ef4444";
                      const opacity =
                        typeof element.data.opacity === "number"
                          ? element.data.opacity
                          : 0.3;
                      const borderWidth =
                        typeof element.data.border_width === "number"
                          ? element.data.border_width
                          : 3;
                      const name =
                        typeof element.data.name === "string" ? element.data.name : "";
                      const labelFontSize = Math.max(map.height * 0.03, 32);
                      const centerX =
                        points.reduce((sum, point) => sum + point[0], 0) / points.length;
                      const centerY =
                        points.reduce((sum, point) => sum + point[1], 0) / points.length;

                      return (
                        <g key={element.id}>
                          <polygon
                            points={points.map((point) => point.join(",")).join(" ")}
                            fill={color}
                            fillOpacity={opacity}
                            stroke={selectedElementId === element.id ? "#facc15" : color}
                            strokeWidth={selectedElementId === element.id ? borderWidth + 2 : borderWidth}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedElementId(element.id);
                            }}
                          />
                          {name ? (
                            <text
                              x={centerX}
                              y={centerY}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={labelFontSize}
                              fontWeight="700"
                              fill="white"
                              stroke="black"
                              strokeWidth={6}
                              paintOrder="stroke"
                              className="pointer-events-none select-none"
                            >
                              {name}
                            </text>
                          ) : null}
                        </g>
                      );
                    }

                    if (element.type === "drawing" && points.length >= 2) {
                      const path = points.map((point) => point.join(",")).join(" ");
                      const color =
                        typeof element.data.color === "string"
                          ? element.data.color
                          : "#38bdf8";
                      const opacity =
                        typeof element.data.opacity === "number"
                          ? element.data.opacity
                          : 0.85;
                      const brushSize =
                        typeof element.data.brush_size === "number"
                          ? element.data.brush_size
                          : 4;

                      return (
                        <g key={element.id}>
                          <polyline
                            points={path}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={brushSize + 20}
                            style={{ cursor: "pointer" }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedElementId(element.id);
                            }}
                          />
                          <polyline
                            points={path}
                            fill="none"
                            stroke={selectedElementId === element.id ? "#facc15" : color}
                            strokeOpacity={opacity}
                            strokeWidth={selectedElementId === element.id ? brushSize + 2 : brushSize}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </g>
                      );
                    }

                    return null;
                  })}

                  {draftPolygonPoints.length > 1 ? (
                    <polyline
                      points={draftPolygonPoints.map((point) => point.join(",")).join(" ")}
                      fill="none"
                      stroke="#facc15"
                      strokeWidth={3}
                      strokeDasharray="8 6"
                    />
                  ) : null}

                  {drawingState && drawingState.points.length > 1 ? (
                    <polyline
                      points={drawingState.points.map((point) => point.join(",")).join(" ")}
                      fill="none"
                      stroke={drawingDraft.color}
                      strokeOpacity={drawingDraft.opacity}
                      strokeWidth={drawingDraft.brush_size}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                </svg>

                {visibleElements.map((element) => {
                  if (element.type === "marker") {
                    const label =
                      typeof element.data.label === "string" ? element.data.label : "Marker";
                    const markerSize =
                      typeof element.data.marker_size === "number"
                        ? element.data.marker_size
                        : 12;
                    const category =
                      typeof element.data.category === "string"
                        ? element.data.category
                        : "custom";
                    const color = colorForCategory(category);

                    return (
                      <div
                        key={element.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                        style={absolutePosition(element)}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedElementId(element.id);
                        }}
                        onPointerDown={(event) =>
                          tool === "select" ? beginElementDrag(event, element.id) : undefined
                        }
                        title={label}
                      >
                        <div
                          className="rounded-full border-2 shadow-lg"
                          style={{
                            width: `${markerSize}px`,
                            height: `${markerSize}px`,
                            backgroundColor: color,
                            borderColor:
                              selectedElementId === element.id ? "#facc15" : "#020617",
                          }}
                        />
                      </div>
                    );
                  }

                  if (element.type === "text") {
                    const text =
                      typeof element.data.text === "string"
                        ? element.data.text
                        : "";

                    const fontSize =
                      typeof element.data.font_size === "number"
                        ? element.data.font_size
                        : typeof element.data.fontSize === "number"
                          ? element.data.fontSize
                          : 18;

                    const color =
                      typeof element.data.color === "string"
                        ? element.data.color
                        : "#ffffff";

                    return (
                      <div
                        key={element.id}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer select-none font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] ${
                          selectedElementId === element.id ? "outline outline-2 outline-yellow-300" : ""
                        }`}
                        style={{
                          ...absolutePosition(element),
                          color,
                          fontSize: `${fontSize}px`,
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedElementId(element.id);
                        }}
                        onPointerDown={(event) =>
                          tool === "select" ? beginElementDrag(event, element.id) : undefined
                        }
                      >
                        {text}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          ) : null}
        </section>

        <aside>{renderPropertyPanel()}</aside>
      </section>
    </main>
  );
}
