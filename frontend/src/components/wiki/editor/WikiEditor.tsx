"use client";

import { useRef } from "react";

import { WikiToolbar } from "./WikiToolbar";

type WikiEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function WikiEditor({ value, onChange }: WikiEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function replaceSelection(transform: (selected: string) => string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const nextText = transform(selected);
    const nextValue = `${value.slice(0, start)}${nextText}${value.slice(end)}`;
    onChange(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + nextText.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function readFileAsDataUrl(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      replaceSelection(() => `![${file.name}](${result})`);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      <WikiToolbar
        onHeading={(level) => replaceSelection((selected) => `${"#".repeat(level)} ${selected || "Heading"}`)}
        onBold={() => replaceSelection((selected) => `**${selected || "bold text"}**`)}
        onItalic={() => replaceSelection((selected) => `*${selected || "italic text"}*`)}
        onList={() =>
          replaceSelection((selected) => {
            const lines = (selected || "List item").split("\n");
            return lines.map((line) => `- ${line}`).join("\n");
          })
        }
        onImage={({ alt, url }) => replaceSelection(() => `![${alt}](${url})`)}
        onImageUpload={readFileAsDataUrl}
        onArticleLink={(title) => replaceSelection(() => `[[${title}]]`)}
        onHiddenBlock={() => replaceSelection((selected) => `:::hidden\n${selected || "Hidden text"}\n:::`)}
      />

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={18}
        className="w-full rounded-2xl border border-lumen-dark bg-lumen-bg px-4 py-4 font-mono text-sm text-slate-100 outline-none ring-lumen-mid placeholder:text-slate-500 focus:ring-2"
        placeholder="Write wiki content using headings, lists, images and [[Article Links]]"
      />
    </div>
  );
}
