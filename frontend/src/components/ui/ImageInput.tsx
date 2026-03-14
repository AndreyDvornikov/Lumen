"use client";

import { ChangeEvent, ClipboardEvent, DragEvent, useId, useRef, useState } from "react";

import { apiFetch, resolveApiAsset } from "@/lib/api";

type ImageInputProps = {
  value: string | null;
  onChange: (url: string) => void;
  label?: string;
};

type ImageUploadResponse = {
  url: string;
};

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function ImageInput({ value, onChange, label = "Image" }: ImageInputProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function uploadImage(file: File) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("Only PNG, JPEG and WEBP images are allowed.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError("Image exceeds 10 MB limit.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    setError(null);

    try {
      const response = await apiFetch<ImageUploadResponse>("/uploads/image", {
        method: "POST",
        body: formData,
        withAuth: true,
      });
      onChange(response.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void uploadImage(file);
    }
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void uploadImage(file);
    }
  }

  async function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith("image/"));
    if (!item) {
      return;
    }

    event.preventDefault();
    const file = item.getAsFile();
    if (file) {
      await uploadImage(file);
    }
  }

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="block text-sm text-slate-300">
        {label}
      </label>

      <input
        id={inputId}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste image URL"
        className="w-full rounded-xl border border-lumen-dark bg-lumen-bg px-4 py-3 text-slate-100 outline-none ring-lumen-mid placeholder:text-slate-500 focus:ring-2"
      />

      <div
        tabIndex={0}
        onPaste={(event) => void handlePaste(event)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border border-dashed px-4 py-6 text-center text-sm outline-none transition ${
          isDragging
            ? "border-lumen-accent bg-lumen-dark/20 text-lumen-accent"
            : "border-lumen-dark bg-black/20 text-slate-400"
        }`}
      >
        <p>Drag image here</p>
        <p className="mt-1">or press Ctrl+V to paste from clipboard</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="rounded-xl border border-lumen-mid px-4 py-2 text-sm font-semibold text-lumen-accent transition hover:bg-lumen-dark/20 disabled:opacity-60"
        >
          {isUploading ? "Uploading..." : "Upload Image"}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {value ? (
        <div className="overflow-hidden rounded-2xl border border-lumen-dark bg-black/20">
          <img src={resolveApiAsset(value)} alt="Image preview" className="max-h-72 w-full object-cover" />
        </div>
      ) : null}
    </div>
  );
}
