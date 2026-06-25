"use client";

import { FileCode, Loader2, RotateCcw, Sparkles, Wand2 } from "lucide-react";

const STEPS = [
  "이미지 최적화",
  "상품 분석",
  "상세페이지 작성",
  "결과 정리",
];

interface LoadingOverlayProps {
  message: string;
}

export default function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(18,19,26,0.45)] backdrop-blur-sm px-4">
      <div className="card-premium w-full max-w-md p-8 animate-fade-up">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-ink)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-accent-light)]" />
        </div>
        <p className="text-center text-base font-semibold text-[var(--color-ink)]">
          {message}
        </p>
        <p className="mt-2 text-center text-sm text-[var(--color-ink-faint)]">
          보통 30초~2분 정도 소요됩니다
        </p>
        <div className="mt-6 space-y-2">
          {STEPS.map((step, index) => (
            <div
              key={step}
              className="flex items-center gap-3 rounded-xl px-3 py-2 loading-shimmer"
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              <Wand2 className="h-4 w-4 text-[var(--color-accent)]" />
              <span className="text-sm text-[var(--color-ink-muted)]">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EmptyStateHero() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
      {[
        { icon: Sparkles, title: "상품명", desc: "클릭을 유도하는 제목" },
        { icon: Wand2, title: "상세설명", desc: "설득력 있는 본문 카피" },
        { icon: RotateCcw, title: "SEO 키워드", desc: "검색 노출 최적화" },
        { icon: FileCode, title: "HTML 내보내기", desc: "즉시 업로드 가능" },
      ].map(({ icon: Icon, title, desc }) => (
        <div key={title} className="card-soft p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-[var(--color-border)]">
            <Icon className="h-4 w-4 text-[var(--color-accent)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--color-ink)]">{title}</p>
          <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{desc}</p>
        </div>
      ))}
    </div>
  );
}
