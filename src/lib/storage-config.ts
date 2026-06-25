import { isEphemeralStorage, isServerlessRuntime } from "@/lib/data-path";
import { isKvStorageEnabled } from "@/lib/storage-kv";

export type StorageMode = "redis" | "local" | "ephemeral";

export const EPHEMERAL_STORAGE_WARNING =
  "Upstash for Redis가 연결되지 않아 생성 이력이 유지되지 않을 수 있습니다. Vercel 대시보드 → Storage → Create Database → Upstash for Redis를 연결한 뒤 Redeploy해 주세요.";

export function getStorageMode(): StorageMode {
  if (isKvStorageEnabled()) {
    return "redis";
  }

  if (isServerlessRuntime()) {
    return "ephemeral";
  }

  return "local";
}

export function getStorageWarning(): string | null {
  return isEphemeralStorage() ? EPHEMERAL_STORAGE_WARNING : null;
}

export function getStorageStatus() {
  const mode = getStorageMode();

  return {
    mode,
    persistent: mode === "redis" || mode === "local",
    warning: getStorageWarning(),
  };
}
