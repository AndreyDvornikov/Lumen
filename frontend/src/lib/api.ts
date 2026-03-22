import { getToken } from "@/lib/auth";

type ApiFetchOptions = RequestInit & {
  withAuth?: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

function toUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_BASE}${path}`;
}

export function resolveApiAsset(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;

  // уже полный URL — не трогаем
  if (pathOrUrl.startsWith("http")) {
    return pathOrUrl;
  }

  const token = getToken();

  // если это файл (uploads/static) → проксируем через protected-image
  if (
    pathOrUrl.includes("/uploads") ||
    pathOrUrl.includes("/static")
  ) {
    const cleanPath = pathOrUrl
      .replace(/^\/static\/uploads\//, "")
      .replace(/^\/uploads\//, "")
      .replace(/^\/static\//, "");

    return `${API_BASE}/protected-image/${cleanPath}?token=${token}`;
  }

  return toUrl(pathOrUrl);
}

export function resolveWebSocketUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const wsBase = API_BASE.replace(/^http/, "ws");
  return `${wsBase}${normalizedPath}`;
}
export function resolveProtectedImage(path: string): string {
  const token = getToken();
  return `${API_BASE}/protected-image/${path}?token=${token}`;
}

export async function apiFetch<T>(pathOrUrl: string, options: ApiFetchOptions = {}): Promise<T> {
  const { withAuth = true, headers = {}, ...rest } = options;
  const token = getToken();
  const requestHeaders = new Headers(headers);
  const isFormDataBody = typeof FormData !== "undefined" && rest.body instanceof FormData;

  if (!isFormDataBody && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (withAuth && token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(toUrl(pathOrUrl), {
    ...rest,
    headers: requestHeaders,
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
