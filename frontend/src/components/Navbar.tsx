"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";
import type { AuthUser } from "@/components/wiki/types";

const NAV_LINKS = [
  { href: "/maps", label: "Maps" },
  { href: "/wiki", label: "Wiki" },
  { href: "/characters", label: "Characters" },
  { href: "/videos", label: "Chronicles" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [hasToken, setHasToken] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setHasToken(Boolean(getToken()));
  }, [pathname]);

  useEffect(() => {
    if (!getToken()) {
      setCurrentUser(null);
      return;
    }

    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const user = await apiFetch<AuthUser>("/auth/me");
        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
        }
      }
    }

    void loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  function handleLogout() {
    logout();
    setHasToken(false);
    router.replace("/login");
  }

  return (
    <header className="border-b border-lumen-dark bg-lumen-bg">
      <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-6">
          <Link href="/" className="shrink-0 text-lg font-semibold text-lumen-accent hover:text-lumen-accent/90">
            Lumen Protocol
          </Link>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    active ? "bg-lumen-dark/40 text-lumen-accent" : "text-gray-300 hover:text-lumen-accent"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {currentUser?.role === "gm" ? (
              <>
                <Link
                  href="/gm/wiki"
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    pathname.startsWith("/gm/wiki")
                      ? "bg-lumen-dark/40 text-lumen-accent"
                      : "text-gray-300 hover:text-lumen-accent"
                  }`}
                >
                  GM Wiki
                </Link>
                <Link
                  href="/gm/players"
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    pathname.startsWith("/gm/players")
                      ? "bg-lumen-dark/40 text-lumen-accent"
                      : "text-gray-300 hover:text-lumen-accent"
                  }`}
                >
                  Players
                </Link>
                <Link
                  href="/gm/maps"
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    pathname.startsWith("/gm/maps")
                      ? "bg-lumen-dark/40 text-lumen-accent"
                      : "text-gray-300 hover:text-lumen-accent"
                  }`}
                >
                  GM Maps
                </Link>
              </>
            ) : null}
          </div>
        </div>

        {hasToken ? (
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-md border border-lumen-dark px-3 py-1.5 text-sm text-gray-300 transition hover:border-lumen-mid hover:text-lumen-accent"
          >
            Logout
          </button>
        ) : (
          <Link
            href="/login"
            className="shrink-0 rounded-md border border-lumen-dark px-3 py-1.5 text-sm text-gray-300 transition hover:border-lumen-mid hover:text-lumen-accent"
          >
            Login
          </Link>
        )}
      </nav>
    </header>
  );
}
