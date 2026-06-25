const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export interface ImageInput {
  data: string;
  mimeType: string;
  name: string;
}

export function imagesToDataUrls(images: ImageInput[]): string[] {
  return images.map((image) => {
    if (!ALLOWED_TYPES.has(image.mimeType)) {
      throw new Error(`허용되지 않는 파일 형식: ${image.mimeType}`);
    }

    const buffer = Buffer.from(image.data, "base64");
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`파일 크기 초과: ${image.name} (최대 10MB)`);
    }

    return `data:${image.mimeType};base64,${image.data}`;
  });
}
