const PRODUCTS_KEY = "detailmaster:products";
const MAX_STORED_PRODUCTS = 30;

function getRedisConfig(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return { url: url.replace(/\/$/, ""), token };
}

/** Vercel KV(구) 또는 Upstash Redis 연결 여부 */
export function isKvStorageEnabled(): boolean {
  return getRedisConfig() !== null;
}

async function redisGet<T>(key: string): Promise<T | null> {
  const config = getRedisConfig();
  if (!config) {
    return null;
  }

  const response = await fetch(`${config.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { result?: T | null };
  return payload.result ?? null;
}

async function redisSet(key: string, value: unknown): Promise<void> {
  const config = getRedisConfig();
  if (!config) {
    throw new Error("Redis storage is not configured.");
  }

  const response = await fetch(`${config.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });

  if (!response.ok) {
    throw new Error("Redis 저장에 실패했습니다.");
  }
}

export async function readProductsFromKv(): Promise<unknown[]> {
  if (!isKvStorageEnabled()) {
    return [];
  }

  try {
    const products = await redisGet<unknown[]>(PRODUCTS_KEY);
    return Array.isArray(products) ? products : [];
  } catch {
    return [];
  }
}

export async function writeProductsToKv(products: unknown[]): Promise<void> {
  const trimmed = products.slice(0, MAX_STORED_PRODUCTS);
  await redisSet(PRODUCTS_KEY, trimmed);
}
