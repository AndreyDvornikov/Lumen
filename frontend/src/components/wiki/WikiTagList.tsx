type WikiTagListProps = {
  tags: string[];
};

export function WikiTagList({ tags }: WikiTagListProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-lumen-mid/60 bg-lumen-dark/20 px-3 py-1 text-xs uppercase tracking-[0.15em] text-lumen-accent"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
