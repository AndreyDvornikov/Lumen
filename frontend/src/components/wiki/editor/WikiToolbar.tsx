"use client";

type WikiToolbarProps = {
  onHeading: (level: 1 | 2 | 3) => void;
  onBold: () => void;
  onItalic: () => void;
  onList: () => void;
  onImage: (payload: { alt: string; url: string }) => void;
  onImageUpload: (file: File) => void;
  onArticleLink: (title: string) => void;
  onHiddenBlock: () => void;
};

export function WikiToolbar({
  onHeading,
  onBold,
  onItalic,
  onList,
  onImage,
  onImageUpload,
  onArticleLink,
  onHiddenBlock,
}: WikiToolbarProps) {
  function handleImageInsert() {
    const url = window.prompt("Image URL");
    if (!url) {
      return;
    }
    const alt = window.prompt("Image description") ?? "";
    onImage({ alt, url });
  }

  function handleArticleLinkInsert() {
    const title = window.prompt("Article title to link");
    if (!title) {
      return;
    }
    onArticleLink(title);
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-lumen-dark bg-black/20 p-3">
      <button type="button" onClick={() => onHeading(1)} className="rounded-lg border border-lumen-dark px-3 py-1.5 text-sm text-slate-200">
        H1
      </button>
      <button type="button" onClick={() => onHeading(2)} className="rounded-lg border border-lumen-dark px-3 py-1.5 text-sm text-slate-200">
        H2
      </button>
      <button type="button" onClick={() => onHeading(3)} className="rounded-lg border border-lumen-dark px-3 py-1.5 text-sm text-slate-200">
        H3
      </button>
      <button type="button" onClick={onBold} className="rounded-lg border border-lumen-dark px-3 py-1.5 text-sm font-semibold text-slate-200">
        Bold
      </button>
      <button type="button" onClick={onItalic} className="rounded-lg border border-lumen-dark px-3 py-1.5 text-sm italic text-slate-200">
        Italic
      </button>
      <button type="button" onClick={onList} className="rounded-lg border border-lumen-dark px-3 py-1.5 text-sm text-slate-200">
        List
      </button>
      <button type="button" onClick={handleImageInsert} className="rounded-lg border border-lumen-dark px-3 py-1.5 text-sm text-slate-200">
        Image URL
      </button>
      <label className="cursor-pointer rounded-lg border border-lumen-dark px-3 py-1.5 text-sm text-slate-200">
        Upload Image
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onImageUpload(file);
            }
            event.target.value = "";
          }}
        />
      </label>
      <button type="button" onClick={handleArticleLinkInsert} className="rounded-lg border border-lumen-dark px-3 py-1.5 text-sm text-slate-200">
        Article Link
      </button>
      <button type="button" onClick={onHiddenBlock} className="rounded-lg border border-lumen-dark px-3 py-1.5 text-sm text-slate-200">
        Hidden Block
      </button>
    </div>
  );
}
