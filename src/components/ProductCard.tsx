"use client";

import { Clock, CheckCircle2, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import type { Product, GeneratedPage } from "@/types";

interface ProductWithPages extends Product {
  generated_pages: GeneratedPage[];
}

interface ProductCardProps {
  product: ProductWithPages;
}

const statusConfig = {
  pending: {
    icon: Clock,
    className: "bg-amber-50 text-amber-700 border-amber-200/80",
    label: "대기",
  },
  processing: {
    icon: Loader2,
    className: "bg-sky-50 text-sky-700 border-sky-200/80",
    label: "생성 중",
  },
  completed: {
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    label: "완료",
  },
  failed: {
    icon: XCircle,
    className: "bg-rose-50 text-rose-700 border-rose-200/80",
    label: "실패",
  },
};

export default function ProductCard({ product }: ProductCardProps) {
  const status = statusConfig[product.status];
  const StatusIcon = status.icon;
  const page = product.generated_pages?.[0];
  const thumbnail = product.image_urls?.[0];

  return (
    <Link
      href={`/dashboard/${product.id}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(18,19,26,0.08)]"
    >
      <div className="relative aspect-[4/3] bg-[var(--color-surface-muted)] overflow-hidden">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt={product.title || "상품"}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-ink-faint)]">
            이미지 없음
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <span
          className={`absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold backdrop-blur-sm ${status.className}`}
        >
          <StatusIcon
            className={`h-3 w-3 ${product.status === "processing" ? "animate-spin" : ""}`}
          />
          {status.label}
        </span>
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-[var(--color-ink)] truncate group-hover:text-[var(--color-accent-dark)] transition-colors">
          {page?.title || product.title || "제목 없음"}
        </h3>
        <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">
          {new Date(product.created_at).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </Link>
  );
}
