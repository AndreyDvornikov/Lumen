"use client";

type WikiSearchProps = {
  query: string;
  onQueryChange: (value: string) => void;
  label?: string;
};

export function WikiSearch({ query, onQueryChange, label = "Search entries" }: WikiSearchProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-300">{label}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search by title or tag"
        className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none ring-lumen-mid placeholder:text-slate-500 focus:ring-2"
      />
    </label>
  );
}
