import requests

BASE = "http://localhost:8000"


def get_openapi_paths():
    try:
        r = requests.get(f"{BASE}/openapi.json")
        if r.status_code != 200:
            print("❌ OpenAPI недоступен")
            return []

        data = r.json()
        paths = data.get("paths", {})
        print(f"📚 Найдено эндпоинтов из OpenAPI: {len(paths)}")
        return list(paths.keys())
    except Exception as e:
        print("❌ Ошибка OpenAPI:", e)
        return []


def brute_common_paths():
    return [
        "/wiki/entries",
        "/wiki/categories",
        "/maps",
        "/maps/1",
        "/maps/1/layers",
        "/maps/layers/1/elements",
        "/auth/me",
        "/static/",
        "/uploads/",
    ]


def expand_ids(paths):
    expanded = set(paths)

    for path in paths:
        if "{id}" in path or "{map_id}" in path:
            for i in range(1, 6):
                expanded.add(path.replace("{id}", str(i)).replace("{map_id}", str(i)))

    return list(expanded)


def scan(endpoints, headers=None):
    results = []

    for ep in endpoints:
        url = BASE + ep
        try:
            r = requests.get(url, headers=headers, timeout=3)
            results.append((ep, r.status_code))
        except Exception as e:
            results.append((ep, f"ERROR {e}"))

    return results


def print_results(title, results):
    print(f"\n=== {title} ===")
    for ep, status in results:
        mark = "🔥" if status == 200 else "✅"
        print(f"{mark} {ep:40} -> {status}")


# --- MAIN ---

paths = get_openapi_paths()
paths += brute_common_paths()
paths = expand_ids(paths)

# Уникальные
paths = list(set(paths))

print(f"🔍 Всего проверяем: {len(paths)} эндпоинтов")

# Без токена
results_no_auth = scan(paths)
print_results("Без токена", results_no_auth)

# С фейковым токеном
headers = {"Authorization": "Bearer fake_token"}
results_fake = scan(paths, headers=headers)
print_results("С фейковым токеном", results_fake)
