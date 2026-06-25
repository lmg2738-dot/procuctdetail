import type { FAQItem, GeneratedContent, ProductAnalysis } from "@/types";

type RawRecord = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item) => item.length > 0);
}

function normalizeFaq(value: unknown): FAQItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as RawRecord;
      const question = asString(record.question);
      const answer = asString(record.answer);
      if (!question && !answer) return null;
      return {
        question: question || "자주 묻는 질문",
        answer: answer || "상세 내용은 상품 페이지를 참고해 주세요.",
      };
    })
    .filter((item): item is FAQItem => item !== null);
}

export function normalizeGeneratedContent(raw: unknown): GeneratedContent {
  const data = (raw && typeof raw === "object" ? raw : {}) as RawRecord;

  const title = asString(data.title, "상품명");
  const description = asString(
    data.description,
    "상품 상세 설명이 곧 업데이트됩니다."
  );

  const features = asStringArray(data.features);
  const faq = normalizeFaq(data.faq);
  const seoKeywords = asStringArray(data.seoKeywords ?? data.seo_keywords);

  const thumbnailText = asString(
    data.thumbnailText ?? data.thumbnail_text,
    title.slice(0, 20) || "특가"
  );
  const marketingCopy = asString(
    data.marketingCopy ?? data.marketing_copy,
    description.slice(0, 150) || "지금 만나보세요."
  );

  return {
    title,
    description,
    features:
      features.length > 0 ? features : ["우수한 품질의 상품입니다."],
    faq:
      faq.length > 0
        ? faq
        : [
            {
              question: "배송은 얼마나 걸리나요?",
              answer: "주문 후 2~3일 내 출고됩니다.",
            },
          ],
    seoKeywords: seoKeywords.length > 0 ? seoKeywords : [title],
    thumbnailText,
    marketingCopy,
  };
}

export function normalizeProductAnalysis(raw: unknown): ProductAnalysis {
  const data = (raw && typeof raw === "object" ? raw : {}) as RawRecord;

  return {
    category: asString(data.category, "기타"),
    productType: asString(data.productType ?? data.product_type, "상품"),
    colors: asStringArray(data.colors),
    materials: asStringArray(data.materials),
    keyFeatures: asStringArray(data.keyFeatures ?? data.key_features),
    targetAudience: asString(
      data.targetAudience ?? data.target_audience,
      "일반 소비자"
    ),
    priceRange: asString(data.priceRange ?? data.price_range, "가격 문의"),
    brandStyle: asString(data.brandStyle ?? data.brand_style, "모던"),
  };
}

export function normalizeCombinedResult(
  raw: unknown
): { analysis: ProductAnalysis; content: GeneratedContent } | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as RawRecord;
  const analysis = normalizeProductAnalysis(data.analysis);
  const content = normalizeGeneratedContent(data.content);

  if (!analysis.productType || !content.title) {
    return null;
  }

  return { analysis, content };
}
