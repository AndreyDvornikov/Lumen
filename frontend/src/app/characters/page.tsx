"use client";

const token = getToken();
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CharacterCard from "@/components/CharacterCard";
import { apiFetch } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";

type AuthUser = {
  id: number;
  email: string;
  role: "gm" | "player";
};

const characters = [
  {
    name: "Сетх",
    class: "Колдун",
    subclass: "Великий механизм",
    race: "Нежить",
    subrace: "Мумия",
    status: "Жив",
    avatar: `${API_BASE}/protected-image/characters/SETH.jpg?token=${token}`,
    backstory: "???",
  },
  {
    name: "Варрин",
    class: "Жрец",
    subclass: "Домен Света",
    race: "Гном",
    subrace: "Лесной",
    status: "Жив",
    avatar: `${API_BASE}/protected-image/characters/default2.png?token=${token}`,
    backstory: "???",
  },
  {
    name: "Мак Высер",
    class: "Плут",
    subclass: "Скаут",
    race: "Человек",
    subrace: "Альтернативный",
    status: "Жив",
    avatar: `${API_BASE}/protected-image/characters/default3.png?token=${token}`,
    backstory: "???",
  },
  {
    name: "Оливер",
    class: "Алхимик",
    subclass: "Стрелок",
    race: "Человек",
    subrace: "Альтернативный",
    status: "Жив",
    avatar: `${API_BASE}/protected-image/characters/Oliver.png?token=${token}`,
    backstory: "???",
  },
];

export default function CharactersPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      const token = getToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const user = await apiFetch<AuthUser>("/auth/me");

        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch (err) {
        if (!cancelled) {
          logout();
          router.replace("/login");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="characters-page">
        <p className="text-slate-300">Loading...</p>
      </main>
    );
  }

  return (
    <main className="characters-page">
      <div className="film-grain"></div>
      <div className="desk">
        {characters.map((c, index) => (
          <CharacterCard key={index} character={c} />
        ))}
      </div>
    </main>
  );
}