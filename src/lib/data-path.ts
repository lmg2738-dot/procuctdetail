import os from "os";
import path from "path";

/** Vercel/Lambda 등 읽기 전용 파일시스템 환경 */
export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY
  );
}

export function isEphemeralStorage(): boolean {
  return isServerlessRuntime();
}

export function getDataRoot(): string {
  if (isServerlessRuntime()) {
    return path.join(os.tmpdir(), "detailmaster-data");
  }

  return path.join(process.cwd(), "data");
}

export function getImagesRoot(): string {
  return path.join(getDataRoot(), "images");
}

export function getProductsFilePath(): string {
  return path.join(getDataRoot(), "products.json");
}
