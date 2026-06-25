export async function compressImageFile(
  file: File,
  maxWidth = 1024,
  quality = 0.85
): Promise<{ data: string; mimeType: string; name: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("이미지 처리에 실패했습니다.");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const mimeType = file.type === "image/png" ? "image/jpeg" : file.type;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("이미지 압축에 실패했습니다."));
      },
      mimeType,
      quality
    );
  });

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  const base64 = btoa(binary);

  const ext = mimeType.split("/")[1] ?? "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");

  return {
    data: base64,
    mimeType,
    name: `${baseName}.${ext}`,
  };
}

export async function filesToCompressedImages(
  files: File[],
  maxImages = 2,
  maxWidth = 1024
): Promise<{ data: string; mimeType: string; name: string }[]> {
  const selected = files.slice(0, maxImages);
  return Promise.all(selected.map((file) => compressImageFile(file, maxWidth)));
}
