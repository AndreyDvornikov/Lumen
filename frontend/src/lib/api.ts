import { getToken } from "@/lib/auth";

type ApiFetchOptions = RequestInit & {
  withAuth?: boolean;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

function toUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_BASE}${path}`;
}

export function resolveApiAsset(pathOrUrl: string): string {
  return toUrl(pathOrUrl);
}

export function resolveWebSocketUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const wsBase = API_BASE.replace(/^http/, "ws");
  return `${wsBase}${normalizedPath}`;
}

export async function apiFetch<T>(pathOrUrl: string, options: ApiFetchOptions = {}): Promise<T> {
  const { withAuth = true, headers = {}, ...rest } = options;

  const token = getToken();

  const response = await fetch(toUrl(pathOrUrl), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers as Record<string, string>),
      ...(withAuth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: rest.cache ?? "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("API ERROR RESPONSE:", text);
    throw new Error(`Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return (await response.json()) as T;
}