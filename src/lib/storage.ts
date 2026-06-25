import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  getDataRoot,
  getImagesRoot,
  getProductsFilePath,
} from "@/lib/data-path";
import type { GeneratedPage, Product, ProductAnalysis } from "@/types";

const PRODUCTS_FILE = getProductsFilePath();
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
const CACHE_TTL_MS = 5_000;

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

  cache = await readProductsFromDisk();
  cacheLoadedAt = now;
  return cache;
}

function invalidateCache(): void {
  cache = null;
  cacheLoadedAt = 0;
}

async function writeProducts(products: StoredProduct[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
  cache = products;
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
  }
): Promise<{ product: StoredProduct; page: GeneratedPage }> {
  const products = await readProducts();
  const index = products.findIndex((product) => product.id === productId);

  if (index === -1) {
    throw new Error("상품을 찾을 수 없습니다.");
  }

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
  errorMessage: string
): Promise<void> {
  const products = await readProducts();
  const index = products.findIndex((product) => product.id === productId);

  if (index === -1) {
    return;
  }

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

  const imageDir = path.join(getImagesRoot(), id);
  await fs.rm(imageDir, { recursive: true, force: true });

  return true;
}
