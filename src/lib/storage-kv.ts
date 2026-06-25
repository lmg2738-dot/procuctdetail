const PRODUCTS_KEY = "detailmaster:products";
const MAX_STORED_PRODUCTS = 30;

export function isKvStorageEnabled(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL?.trim() &&
      process.env.KV_REST_API_TOKEN?.trim()
  );
}

function getKvConfig(): { url: string; token: string } {
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();

  if (!url || !token) {
    throw new Error("KV storage is not configured.");
  }

  return { url: url.replace(/\/$/, ""), token };
}

async function kvGet<T>(key: string): Promise<T | null> {
  const { url, token } = getKvConfig();
  const response = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { result?: T | null };
  return payload.result ?? null;
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const { url, token } = getKvConfig();
  const response = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });

  if (!response.ok) {
    throw new Error("KV 저장에 실패했습니다.");
  }
}

export async function readProductsFromKv(): Promise<unknown[]> {
  if (!isKvStorageEnabled()) {
    return [];
  }

  try {
    const products = await kvGet<unknown[]>(PRODUCTS_KEY);
    return Array.isArray(products) ? products : [];
  } catch {
    return [];
  }
}

export async function writeProductsToKv(products: unknown[]): Promise<void> {
  const trimmed = products.slice(0, MAX_STORED_PRODUCTS);
  await kvSet(PRODUCTS_KEY, trimmed);
}
