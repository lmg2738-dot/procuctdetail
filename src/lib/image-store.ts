import { promises as fs } from "fs";
import path from "path";
import { getImagesRoot } from "@/lib/data-path";

function imagesDir(): string {
  return getImagesRoot();
}

export async function saveProductThumbnail(
  productId: string,
  dataUrl: string
): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return dataUrl;
  }

  const mimeType = match[1];
  const ext = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg";

  const dir = path.join(imagesDir(), productId);
  await fs.mkdir(dir, { recursive: true });

  const fileName = `thumb.${ext}`;
  await fs.writeFile(
    path.join(dir, fileName),
    Buffer.from(match[2], "base64")
  );

  return `/api/images/${productId}/${fileName}`;
}

export async function readProductImage(
  productId: string,
  fileName: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const safeName = path.basename(fileName);
  const filePath = path.join(imagesDir(), productId, safeName);

  try {
    const buffer = await fs.readFile(filePath);
    const ext = safeName.split(".").pop()?.toLowerCase();
    const mimeType =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";

    return { buffer, mimeType };
  } catch {
    return null;
  }
}

export function toAbsoluteImageUrl(relativePath: string): string {
  if (relativePath.startsWith("http") || relativePath.startsWith("data:")) {
    return relativePath;
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:50005");

  return `${base}${relativePath.startsWith("/") ? relativePath : `/${relativePath}`}`;
}
