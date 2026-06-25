"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FolderOpen, Loader2, Plus } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import type { Product, GeneratedPage } from "@/types";

interface ProductWithPages extends Product {
  generated_pages: GeneratedPage[];
}

export default function DashboardPage() {
  const [products, setProducts] = useState<ProductWithPages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setProducts(data.products || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "조회 실패");
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  return (
    <div className="page-shell py-10 lg:py-14">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label mb-2">My Workspace</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            내 작업함
          </h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            생성한 상세페이지를 한곳에서 관리하세요
          </p>
        </div>
        <Link href="/" className="btn-primary shrink-0">
          <Plus className="h-4 w-4" />
          새로 만들기
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {products.length === 0 ? (
        <div className="card-premium flex flex-col items-center px-6 py-20 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-muted)] border border-[var(--color-border)]">
            <FolderOpen className="h-7 w-7 text-[var(--color-ink-faint)]" />
          </div>
          <p className="text-lg font-semibold text-[var(--color-ink)]">
            아직 생성된 페이지가 없습니다
          </p>
          <p className="mt-2 max-w-md text-sm text-[var(--color-ink-faint)]">
            상품 사진을 업로드하면 AI가 상세페이지 초안을 만들어 드립니다
          </p>
          <Link href="/" className="btn-primary mt-8">
            첫 상세페이지 만들기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
