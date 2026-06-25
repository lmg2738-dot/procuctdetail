"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ImagePlus, X } from "lucide-react";

interface ImageUploadProps {
  onImagesChange: (files: File[]) => void;
  maxFiles?: number;
}

export default function ImageUpload({
  onImagesChange,
  maxFiles = 10,
}: ImageUploadProps) {
  const [previews, setPreviews] = useState<
    { file: File; preview: string }[]
  >([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const remaining = maxFiles - previews.length;
      const newFiles = acceptedFiles.slice(0, remaining);

      const newPreviews = newFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));

      const updated = [...previews, ...newPreviews];
      setPreviews(updated);
      onImagesChange(updated.map((p) => p.file));
    },
    [previews, maxFiles, onImagesChange]
  );

  const removeImage = (index: number) => {
    const updated = previews.filter((_, i) => i !== index);
    URL.revokeObjectURL(previews[index].preview);
    setPreviews(updated);
    onImagesChange(updated.map((p) => p.file));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: maxFiles - previews.length,
    disabled: previews.length >= maxFiles,
  });

  return (
    <div className="space-y-4">
      {previews.length < maxFiles && previews.length === 0 && (
        <div
          {...getRootProps()}
          className={`relative overflow-hidden rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
            isDragActive
              ? "border-[var(--color-accent)] bg-[rgba(196,165,116,0.12)] scale-[1.01]"
              : "border-[var(--color-border-strong)] hover:border-[rgba(154,123,79,0.45)] hover:bg-[var(--color-surface-muted)]"
          }`}
        >
          <input {...getInputProps()} />
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-surface-muted)] border border-[var(--color-border)]">
              <ImagePlus className="h-6 w-6 text-[var(--color-accent)]" />
            </div>
            <p className="text-base font-semibold text-[var(--color-ink)]">
              {isDragActive
                ? "여기에 놓으면 업로드됩니다"
                : "상품 사진을 드래그하거나 클릭하세요"}
            </p>
            <p className="mt-2 text-sm text-[var(--color-ink-faint)]">
              JPG · PNG · WebP · 최대 {maxFiles}장 · 각 10MB 이하
            </p>
          </div>
        </div>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {previews.map((preview, index) => (
            <div
              key={preview.preview}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.preview}
                alt={`상품 이미지 ${index + 1}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <button
                type="button"
                onClick={() => removeImage(index)}
                aria-label="이미지 삭제"
                className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[var(--color-ink)] shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
              <span className="absolute bottom-2.5 left-2.5 rounded-md bg-black/55 px-2 py-1 text-[0.6875rem] font-semibold text-white backdrop-blur-sm">
                {index === 0 ? "대표" : `#${index + 1}`}
              </span>
            </div>
          ))}

          {previews.length < maxFiles && (
            <div
              {...getRootProps()}
              className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] text-[var(--color-ink-faint)] transition-colors hover:border-[rgba(154,123,79,0.45)] hover:text-[var(--color-accent)]"
            >
              <input {...getInputProps()} />
              <ImagePlus className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">추가</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
