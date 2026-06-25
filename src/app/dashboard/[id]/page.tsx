"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import GeneratedOutput from "@/components/GeneratedOutput";
import ExportButtons from "@/components/ExportButtons";
import { normalizeGeneratedContent } from "@/lib/normalize-content";
import type { Product, GeneratedPage, GeneratedContent } from "@/types";

interface ProductWithPages extends Product {
  generated_pages: GeneratedPage[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<ProductWithPages | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/products/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setProduct(data.product);
      } catch (err) {
        setError(err instanceof Error ? err.message : "조회 실패");
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page-shell py-14 text-center">
        <p className="text-rose-600">{error || "상품을 찾을 수 없습니다."}</p>
        <Link href="/dashboard" className="btn-secondary mt-6 inline-flex">
          <ArrowLeft className="h-4 w-4" />
          작업함으로 돌아가기
        </Link>
      </div>
    );
  }

  const page = product.generated_pages?.[0];

  if (!page) {
    return (
      <div className="page-shell py-14 text-center">
        <p className="text-[var(--color-ink-muted)]">
          {product.status === "processing"
            ? "상세페이지 생성 중입니다..."
            : product.status === "failed"
              ? `생성 실패: ${product.error_message}`
              : "생성된 페이지가 없습니다."}
        </p>
        <Link href="/dashboard" className="btn-secondary mt-6 inline-flex">
          <ArrowLeft className="h-4 w-4" />
          작업함으로 돌아가기
        </Link>
      </div>
    );
  }

  const content: GeneratedContent = normalizeGeneratedContent({
    title: page.title,
    description: page.description,
    features: page.features,
    faq: page.faq,
    seoKeywords: page.seo_keywords,
    thumbnailText: page.thumbnail_text,
    marketingCopy: page.marketing_copy,
  });

  return (
    <div className="page-shell py-10 lg:py-14 animate-fade-up">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        내 작업함
      </Link>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-label mb-2">Saved Project</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            {page.title}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-faint)]">
            {new Date(product.created_at).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <ExportButtons
          html={page.html_content || ""}
          markdown={page.markdown_content || ""}
          title={page.title}
        />
      </div>

      <div className="card-premium p-6 sm:p-8 lg:p-10">
        <GeneratedOutput content={content} />
      </div>
    </div>
  );
}
