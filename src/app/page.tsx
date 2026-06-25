"use client";

import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import GeneratedOutput from "@/components/GeneratedOutput";
import ExportButtons from "@/components/ExportButtons";
import LoadingOverlay, { EmptyStateHero } from "@/components/LoadingOverlay";
import { filesToCompressedImages } from "@/lib/compress-image";
import { readApiJson } from "@/lib/api-client";
import type { GeneratedContent } from "@/types";

export default function HomePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [productHint, setProductHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    content: GeneratedContent;
    html: string;
    markdown: string;
    productId: string;
    warnings: string[];
  } | null>(null);

  const handleGenerate = async () => {
    if (files.length === 0) {
      setError("상품 사진을 1장 이상 업로드해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingMessage("이미지를 최적화하고 있습니다...");

    try {
      const images = await filesToCompressedImages(files, 2);
      setLoadingMessage("AI가 상세페이지를 작성하고 있습니다...");

      const response = await fetch("/api/product/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          productHint: productHint.trim() || undefined,
        }),
      });

      const data = await readApiJson<{
        error?: string;
        content: GeneratedContent;
        html: string;
        markdown: string;
        productId: string;
        warnings?: string[];
      }>(response);

      if (!response.ok) {
        throw new Error(data.error || "생성에 실패했습니다.");
      }

      setResult({
        content: data.content,
        html: data.html,
        markdown: data.markdown,
        productId: data.productId,
        warnings: data.warnings ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  return (
    <>
      {loading && <LoadingOverlay message={loadingMessage} />}

      <div className="page-shell py-10 lg:py-14">
        {!result && (
          <header className="mx-auto max-w-3xl text-center mb-10 lg:mb-14 animate-fade-up">
            <p className="section-label mb-4">Premium AI Commerce Tool</p>
            <h1 className="hero-title">
              사진만 올리면
              <br />
              <span className="text-[var(--color-accent-dark)]">
                상세페이지가 완성됩니다
              </span>
            </h1>
            <p className="hero-subtitle mt-5 max-w-2xl mx-auto">
              스마트스토어, 쿠팡, 아마존 셀러를 위한 AI 상세페이지 스튜디오.
              상품명, 설명, SEO, FAQ까지 한 번에 생성하세요.
            </p>
          </header>
        )}

        {!result ? (
          <div className="mx-auto max-w-3xl">
            <div className="card-premium p-6 sm:p-8 lg:p-10">
              <div className="space-y-8">
                <section>
                  <div className="mb-5 flex items-center gap-3">
                    <span className="step-badge">1</span>
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--color-ink)]">
                        상품 사진 업로드
                      </h2>
                      <p className="text-sm text-[var(--color-ink-faint)] mt-0.5">
                        대표 사진 1장만 있어도 충분합니다
                      </p>
                    </div>
                  </div>
                  <ImageUpload onImagesChange={setFiles} maxFiles={6} />
                </section>

                <div className="h-px bg-[var(--color-border)]" />

                <section>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="step-badge">2</span>
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--color-ink)]">
                        상품 정보 힌트
                        <span className="ml-2 text-sm font-normal text-amber-700">
                          비전 실패 시 필수
                        </span>
                      </h2>
                      <p className="text-sm text-[var(--color-ink-faint)] mt-0.5">
                        자동차·가전 등은 힌트를 넣으면 분석 정확도가 크게 올라갑니다
                      </p>
                    </div>
                  </div>
                  <input
                    id="productHint"
                    type="text"
                    value={productHint}
                    onChange={(e) => setProductHint(e.target.value)}
                    placeholder="예: 현대 팰리세이드 SUV, 블랙 / 여성용 가죽 크로스백"
                    className="input-premium"
                  />
                </section>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading || files.length === 0}
                  className="btn-primary w-full py-4 text-base"
                >
                  <Sparkles className="h-5 w-5" />
                  상세페이지 생성하기
                  <ArrowRight className="h-4 w-4 opacity-70" />
                </button>
              </div>
            </div>

            <EmptyStateHero />
          </div>
        ) : (
          <div className="animate-fade-up space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-label mb-2">Generation Complete</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)]">
                  생성이 완료되었습니다
                </h1>
                <p className="mt-2 text-sm text-[var(--color-ink-faint)]">
                  아래 내용을 확인하고 HTML 또는 Markdown으로 내보내세요
                </p>
              </div>
              <ExportButtons
                html={result.html}
                markdown={result.markdown}
                title={result.content.title}
              />
            </div>

            {result.warnings.length > 0 && (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-5 py-4 text-sm text-amber-900">
                {result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            <div className="card-premium p-6 sm:p-8 lg:p-10">
              <GeneratedOutput content={result.content} />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setFiles([]);
                  setProductHint("");
                }}
                className="btn-secondary"
              >
                새 상품 만들기
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
