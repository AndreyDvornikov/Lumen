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

export async function apiFetch<T>(pathOrUrl: string, options: ApiFetchOptions = {}): Promise<T> {
  const { withAuth = true, headers, ...rest } = options;

  const requestHeaders = new Headers(headers ?? {});
  if (withAuth) {
    const token = getToken();
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(toUrl(pathOrUrl), {
    ...rest,
    headers: requestHeaders,
    cache: rest.cache ?? "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
