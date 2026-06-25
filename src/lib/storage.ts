import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  isKvStorageEnabled,
  readProductsFromKv,
  writeProductsToKv,
} from "@/lib/storage-kv";
import {
  getDataRoot,
  getImagesRoot,
  getProductsFilePath,
} from "@/lib/data-path";
import type { GeneratedPage, Product, ProductAnalysis } from "@/types";

const PRODUCTS_FILE = getProductsFilePath();

export function usesPersistentStorage(): boolean {
  return isKvStorageEnabled();
}
export interface StoredProduct extends Product {
  generated_pages: GeneratedPage[];
}

export interface ProductSummary extends Omit<StoredProduct, "generated_pages"> {
  generated_pages: Array<
    Omit<GeneratedPage, "html_content" | "markdown_content">
  >;
}

let cache: StoredProduct[] | null = null;
let cacheLoadedAt = 0;
/** AI 생성(~20s+) 동안 캐시가 만료되지 않도록 충분히 길게 설정 */
const CACHE_TTL_MS = 300_000;

function mergeProductLists(
  primary: StoredProduct[],
  secondary: StoredProduct[]
): StoredProduct[] {
  const map = new Map<string, StoredProduct>();

  for (const product of secondary) {
    map.set(product.id, product);
  }

  for (const product of primary) {
    const existing = map.get(product.id);
    if (
      !existing ||
      new Date(product.updated_at).getTime() >=
        new Date(existing.updated_at).getTime()
    ) {
      map.set(product.id, product);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function ensureProductInList(
  products: StoredProduct[],
  productId: string,
  fallback?: StoredProduct
): { products: StoredProduct[]; index: number } {
  const index = products.findIndex((product) => product.id === productId);
  if (index !== -1) {
    return { products, index };
  }

  if (fallback?.id === productId) {
    const next = [fallback, ...products.filter((product) => product.id !== productId)];
    return { products: next, index: 0 };
  }

  return { products, index: -1 };
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(getDataRoot(), { recursive: true });
}
async function readProductsFromDisk(): Promise<StoredProduct[]> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(PRODUCTS_FILE, "utf-8");
    if (!raw.trim()) return [];
    return JSON.parse(raw) as StoredProduct[];
  } catch {
    return [];
  }
}

async function readProducts(): Promise<StoredProduct[]> {
  const now = Date.now();
  if (cache && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cache;
  }

  cache = isKvStorageEnabled()
    ? ((await readProductsFromKv()) as StoredProduct[])
    : await readProductsFromDisk();
  cacheLoadedAt = now;
  return cache;
}

function invalidateCache(): void {
  cache = null;
  cacheLoadedAt = 0;
}

async function writeProducts(products: StoredProduct[]): Promise<void> {
  if (isKvStorageEnabled()) {
    const remote = (await readProductsFromKv()) as StoredProduct[];
    const merged = mergeProductLists(products, remote);
    await writeProductsToKv(merged);
    cache = merged;
  } else {
    await ensureDataDir();
    await fs.writeFile(
      PRODUCTS_FILE,
      JSON.stringify(products, null, 2),
      "utf-8"
    );
    cache = products;
  }

  cacheLoadedAt = Date.now();
}

export function toProductSummary(product: StoredProduct): ProductSummary {
  return {
    ...product,
    generated_pages: product.generated_pages.map(
      ({ html_content, markdown_content, ...page }) => page
    ),
  };
}

export async function listProducts(limit = 50): Promise<ProductSummary[]> {
  const products = await readProducts();
  return products.slice(0, limit).map(toProductSummary);
}

export async function getProductById(id: string): Promise<StoredProduct | null> {
  const products = await readProducts();
  return products.find((product) => product.id === id) ?? null;
}

export async function createProduct(imageUrls: string[]): Promise<StoredProduct> {
  const now = new Date().toISOString();
  const product: StoredProduct = {
    id: randomUUID(),
    title: null,
    status: "processing",
    image_urls: imageUrls,
    analysis: null,
    error_message: null,
    created_at: now,
    updated_at: now,
    generated_pages: [],
  };

  const products = await readProducts();
  products.unshift(product);
  await writeProducts(products);
  return product;
}

export async function updateProductImages(
  productId: string,
  imageUrls: string[]
): Promise<void> {
  const products = await readProducts();
  const index = products.findIndex((product) => product.id === productId);
  if (index === -1) return;

  products[index] = {
    ...products[index],
    image_urls: imageUrls,
    updated_at: new Date().toISOString(),
  };

  await writeProducts(products);
}

export async function completeProduct(
  productId: string,
  data: {
    title: string;
    analysis: ProductAnalysis;
    page: Omit<GeneratedPage, "id" | "product_id" | "created_at" | "updated_at">;
  },
  options?: { knownProduct?: StoredProduct }
): Promise<{ product: StoredProduct; page: GeneratedPage }> {
  let products = await readProducts();
  const located = ensureProductInList(
    products,
    productId,
    options?.knownProduct
  );

  if (located.index === -1) {
    throw new Error("상품을 찾을 수 없습니다.");
  }

  products = located.products;
  const index = located.index;

  const now = new Date().toISOString();
  const page: GeneratedPage = {
    id: randomUUID(),
    product_id: productId,
    created_at: now,
    updated_at: now,
    ...data.page,
  };

  products[index] = {
    ...products[index],
    title: data.title,
    status: "completed",
    analysis: data.analysis,
    error_message: null,
    updated_at: now,
    generated_pages: [page],
  };

  await writeProducts(products);
  return { product: products[index], page };
}

export async function failProduct(
  productId: string,
  errorMessage: string,
  options?: { knownProduct?: StoredProduct }
): Promise<void> {
  let products = await readProducts();
  const located = ensureProductInList(
    products,
    productId,
    options?.knownProduct
  );

  if (located.index === -1) {
    return;
  }

  products = located.products;
  const index = located.index;

  products[index] = {
    ...products[index],
    status: "failed",
    error_message: errorMessage,
    updated_at: new Date().toISOString(),
  };

  await writeProducts(products);
}

export async function deleteProduct(id: string): Promise<boolean> {
  const products = await readProducts();
  const nextProducts = products.filter((product) => product.id !== id);

  if (nextProducts.length === products.length) {
    return false;
  }

  await writeProducts(nextProducts);

  if (!isKvStorageEnabled()) {
    const imageDir = path.join(getImagesRoot(), id);
    await fs.rm(imageDir, { recursive: true, force: true });
  }

  return true;
}
