"use client";

import type { GeneratedContent } from "@/types";
import {
  Copy,
  HelpCircle,
  Megaphone,
  MessageSquare,
  Sparkles,
  Tag,
} from "lucide-react";
import { useState, type ReactNode } from "react";

interface GeneratedOutputProps {
  content: GeneratedContent;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="btn-secondary text-xs py-1.5 px-2.5"
      aria-label={`${label} 복사`}
    >
      <Copy className="h-3.5 w-3.5" />
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  copyText,
}: {
  icon: typeof Tag;
  title: string;
  children: ReactNode;
  copyText?: string;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-surface-muted)]">
            <Icon className="h-4 w-4 text-[var(--color-accent)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--color-ink)]">
            {title}
          </h3>
        </div>
        {copyText && <CopyButton text={copyText} label={title} />}
      </div>
      {children}
    </section>
  );
}

export default function GeneratedOutput({ content }: GeneratedOutputProps) {
  const features = content.features ?? [];
  const faq = content.faq ?? [];
  const seoKeywords = content.seoKeywords ?? [];

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-[var(--color-ink)] p-8 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(196,165,116,0.35),transparent_55%)]" />
        <div className="relative">
          <span className="section-label text-[var(--color-accent-light)]">
            썸네일 문구
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight leading-snug">
            {content.title}
          </h2>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/90 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent-light)]" />
            {content.thumbnailText}
          </p>
        </div>
      </div>

      <Section
        icon={MessageSquare}
        title="상품 설명"
        copyText={content.description}
      >
        <p className="text-[0.9375rem] leading-7 text-[var(--color-ink-muted)] whitespace-pre-wrap">
          {content.description}
        </p>
      </Section>

      <Section
        icon={Megaphone}
        title="광고 문구"
        copyText={content.marketingCopy}
      >
        <blockquote className="border-l-2 border-[var(--color-accent-light)] pl-4 text-[0.9375rem] leading-7 text-[var(--color-ink-muted)] italic">
          {content.marketingCopy}
        </blockquote>
      </Section>

      <Section icon={Sparkles} title="상품 장점">
        <ul className="space-y-2.5">
          {features.map((feature, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl bg-[var(--color-surface-muted)] px-4 py-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[0.6875rem] font-bold text-[var(--color-accent-light)]">
                {i + 1}
              </span>
              <span className="text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={HelpCircle} title="FAQ">
        <div className="space-y-3">
          {faq.map((item, i) => (
            <details
              key={i}
              className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] open:bg-white open:shadow-sm"
            >
              <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-[var(--color-ink)] marker:content-none">
                <span className="text-[var(--color-accent)] mr-2">Q.</span>
                {item.question}
              </summary>
              <div className="border-t border-[var(--color-border)] px-4 py-3.5 text-sm leading-6 text-[var(--color-ink-muted)]">
                <span className="font-medium text-[var(--color-ink)] mr-2">
                  A.
                </span>
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </Section>

      <Section
        icon={Tag}
        title="SEO 키워드"
        copyText={seoKeywords.join(", ")}
      >
        <div className="flex flex-wrap gap-2">
          {seoKeywords.map((keyword, i) => (
            <span
              key={i}
              className="rounded-full border border-[rgba(154,123,79,0.25)] bg-[rgba(196,165,116,0.12)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent-dark)]"
            >
              #{keyword}
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}
