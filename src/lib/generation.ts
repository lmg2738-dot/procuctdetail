import {
  normalizeCombinedResult,
  normalizeGeneratedContent,
  normalizeProductAnalysis,
} from "./normalize-content";
import {
  beginGenerationBudget,
  chatWithFreeTextModels,
  chatWithFreeVisionModels,
  clearGenerationBudget,
  generateImageWithFreeModels,
  tryChatWithFreeTextModels,
  tryChatWithFreeVisionModels,
} from "./openrouter";
import type { GeneratedContent, ProductAnalysis } from "@/types";

interface CombinedResult {
  analysis: ProductAnalysis;
  content: GeneratedContent;
}

export type GenerationSource =
  | "vision-combined"
  | "vision-split"
  | "hint-ai"
  | "hint-offline";

const VISION_ACCURACY_RULES = `
CRITICAL RULES FOR IMAGE ANALYSIS:
1. Look at the uploaded photo carefully. Identify the ACTUAL main subject visible in the image.
2. Do NOT guess or invent a different product. If you see a car, report a car — not a bag, clothing, or unrelated item.
3. Base category, productType, colors, materials, and keyFeatures ONLY on what is visually evident.
4. If the seller hint conflicts with the image, TRUST THE IMAGE over the hint.
5. For vehicles: include make/model style if visible, body type (sedan/SUV/truck), color, and notable exterior features.
6. For non-vehicle products: describe the exact item type shown (e.g. handbag, sneakers, skincare bottle).`;

function buildVisionPrompt(basePrompt: string, productHint?: string): string {
  const hintSection = productHint?.trim()
    ? `\n\nOptional seller hint (use only if consistent with the image): ${productHint.trim()}`
    : "";

  return `${basePrompt}${VISION_ACCURACY_RULES}${hintSection}`;
}

const COMBINED_VISION_PROMPT = `You are an expert Korean e-commerce product analyst and copywriter.
Analyze the product image and generate a complete detail page in one response.

Return a JSON object:
{
  "analysis": {
    "category": "product category in Korean",
    "productType": "specific product type in Korean — must match what is in the photo",
    "colors": ["detected colors"],
    "materials": ["detected materials if visible"],
    "keyFeatures": ["3-5 key visual features from the image"],
    "targetAudience": "target customer description in Korean",
    "priceRange": "estimated price range in Korean won",
    "brandStyle": "brand/style impression in Korean"
  },
  "content": {
    "title": "catchy product title (max 50 chars, Korean)",
    "description": "detailed product description (300-500 chars, Korean, persuasive)",
    "features": ["5-7 key selling points as bullet points in Korean"],
    "faq": [{"question": "...", "answer": "..."}],
    "seoKeywords": ["10-15 SEO keywords in Korean"],
    "thumbnailText": "short catchy text for thumbnail overlay (max 20 chars)",
    "marketingCopy": "ad copy for social media/paid ads (100-150 chars, Korean)"
  }
}

Guidelines:
- Write in natural, persuasive Korean
- Include 3-5 FAQ items
- All copy must match the actual product shown in the image
Return ONLY valid JSON, no markdown.`;

const COMBINED_HINT_PROMPT = `You are an expert Korean e-commerce product analyst and copywriter.
Use the seller hint below as the product subject. Write rich, persuasive Korean copy.

Seller hint: {hint}

Return a JSON object:
{
  "analysis": {
    "category": "product category in Korean",
    "productType": "specific product type in Korean",
    "colors": ["likely colors"],
    "materials": ["likely materials"],
    "keyFeatures": ["3-5 likely selling points"],
    "targetAudience": "target customer description in Korean",
    "priceRange": "estimated price range in Korean won",
    "brandStyle": "brand/style impression in Korean"
  },
  "content": {
    "title": "catchy product title (max 50 chars, Korean)",
    "description": "detailed product description (300-500 chars, Korean, persuasive)",
    "features": ["5-7 key selling points as bullet points in Korean"],
    "faq": [{"question": "...", "answer": "..."}],
    "seoKeywords": ["10-15 SEO keywords in Korean"],
    "thumbnailText": "short catchy text for thumbnail overlay (max 20 chars)",
    "marketingCopy": "ad copy for social media/paid ads (100-150 chars, Korean)"
  }
}

Return ONLY valid JSON, no markdown.`;

const ANALYSIS_PROMPT = `You are an expert e-commerce product analyst.
Analyze the product image and return a JSON object with:
{
  "category": "product category in Korean",
  "productType": "specific product type in Korean — must match what is in the photo",
  "colors": ["detected colors"],
  "materials": ["detected materials if visible"],
  "keyFeatures": ["3-5 key visual features"],
  "targetAudience": "target customer description in Korean",
  "priceRange": "estimated price range in Korean won",
  "brandStyle": "brand/style impression in Korean"
}
Return ONLY valid JSON, no markdown.`;

const GENERATION_PROMPT = `You are an expert Korean e-commerce copywriter for Smart Store, Coupang, and Amazon sellers.
Based on the product analysis below, generate compelling product detail page content.

Product Analysis:
{analysis}

Return a JSON object with:
{
  "title": "catchy product title (max 50 chars, Korean)",
  "description": "detailed product description (300-500 chars, Korean, persuasive)",
  "features": ["5-7 key selling points as bullet points in Korean"],
  "faq": [{"question": "...", "answer": "..."}],
  "seoKeywords": ["10-15 SEO keywords in Korean"],
  "thumbnailText": "short catchy text for thumbnail overlay (max 20 chars)",
  "marketingCopy": "ad copy for social media/paid ads (100-150 chars, Korean)"
}

Guidelines:
- Write in natural, persuasive Korean
- Focus on benefits, not just features
- Include 3-5 FAQ items
- SEO keywords should be relevant search terms
- Content must stay consistent with the analysis (do not change product type)
Return ONLY valid JSON, no markdown.`;

/** 로컬·서버 동일 — 고해상도 비전 입력 */
function buildImageContent(imageUrls: string[]) {
  return imageUrls.slice(0, 2).map((url) => ({
    type: "image_url" as const,
    image_url: { url, detail: "high" as const },
  }));
}

function hasUsableHint(productHint?: string): boolean {
  const hint = productHint?.trim();
  if (!hint) return false;
  const generic = ["온라인 쇼핑몰 판매 상품", "product-image", "product"];
  return !generic.includes(hint);
}

function buildContentFromAnalysis(analysis: ProductAnalysis): GeneratedContent {
  const productName = analysis.productType || analysis.category || "상품";
  const features =
    analysis.keyFeatures.length > 0
      ? analysis.keyFeatures
      : [`${productName}의 핵심 장점`];

  return normalizeGeneratedContent({
    title: productName.slice(0, 50),
    description: `${productName}입니다. ${analysis.targetAudience}에게 추천하는 상품으로, ${features.slice(0, 3).join(", ")} 등의 특징을 갖고 있습니다.`,
    features: features.map((f) => `${f} — 만족도 높은 선택`),
    faq: [
      {
        question: "어떤 분에게 추천하나요?",
        answer: analysis.targetAudience,
      },
      {
        question: "배송은 얼마나 걸리나요?",
        answer: "주문 후 2~3일 내 출고됩니다.",
      },
    ],
    seoKeywords: [
      productName,
      analysis.category,
      ...analysis.colors.slice(0, 3),
    ],
    thumbnailText: productName.slice(0, 20),
    marketingCopy: `${productName} — 지금 만나보세요.`,
  });
}

function buildFallbackFromHint(hint: string): CombinedResult {
  const analysis = normalizeProductAnalysis({
    category: "일반 상품",
    productType: hint,
    colors: [],
    materials: [],
    keyFeatures: [hint],
    targetAudience: "온라인 쇼핑 고객",
    priceRange: "가격 문의",
    brandStyle: "모던",
  });

  return {
    analysis,
    content: buildContentFromAnalysis(analysis),
  };
}

function isThumbnailImageEnabled(): boolean {
  return process.env.ENABLE_THUMBNAIL_IMAGE === "true";
}

async function tryCombinedVision(
  imageUrls: string[],
  productHint?: string
): Promise<CombinedResult | null> {
  const imageContent = buildImageContent(imageUrls);
  const prompt = buildVisionPrompt(COMBINED_VISION_PROMPT, productHint);
  const messages = [
    {
      role: "user" as const,
      content: [{ type: "text" as const, text: prompt }, ...imageContent],
    },
  ];

  try {
    const result = await chatWithFreeVisionModels<CombinedResult>({
      maxTokens: 2400,
      messages,
    });

    return normalizeCombinedResult(result.content);
  } catch {
    const fallback = await tryChatWithFreeVisionModels<CombinedResult>({
      maxTokens: 2400,
      messages,
    });

    return normalizeCombinedResult(fallback?.content ?? null);
  }
}

async function tryVisionAnalysisThenContent(
  imageUrls: string[],
  productHint?: string
): Promise<CombinedResult | null> {
  const imageContent = buildImageContent(imageUrls);
  const analysisPrompt = buildVisionPrompt(ANALYSIS_PROMPT, productHint);

  let analysis: ProductAnalysis | null = null;

  try {
    const visionResult = await chatWithFreeVisionModels<ProductAnalysis>({
      maxTokens: 1000,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: analysisPrompt }, ...imageContent],
        },
      ],
    });
    analysis = normalizeProductAnalysis(visionResult.content);
  } catch {
    const fallback = await tryChatWithFreeVisionModels<ProductAnalysis>({
      maxTokens: 1000,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: analysisPrompt }, ...imageContent],
        },
      ],
    });
    analysis = fallback?.content
      ? normalizeProductAnalysis(fallback.content)
      : null;
  }

  if (!analysis?.category || !analysis.productType) {
    return null;
  }

  let content: GeneratedContent;
  try {
    content = await generateProductContent(analysis);
  } catch {
    content = buildContentFromAnalysis(analysis);
  }

  return { analysis, content };
}

async function tryCombinedHint(
  hint: string
): Promise<{ data: CombinedResult; offline: boolean }> {
  const prompt = COMBINED_HINT_PROMPT.replace("{hint}", hint);
  const request = {
    maxTokens: 2000,
    messages: [{ role: "user" as const, content: prompt }],
  };

  const result = await tryChatWithFreeTextModels<CombinedResult>(request);
  if (result) {
    const normalized = normalizeCombinedResult(result.content);
    if (normalized) {
      return { data: normalized, offline: false };
    }
  }

  try {
    const retry = await chatWithFreeTextModels<CombinedResult>(request);
    const normalized = normalizeCombinedResult(retry.content);
    if (normalized) {
      return { data: normalized, offline: false };
    }
  } catch {
    // 텍스트 모델도 실패 시 오프라인 템플릿으로 대체
  }

  return { data: buildFallbackFromHint(hint), offline: true };
}

export async function generateProductContent(
  analysis: ProductAnalysis
): Promise<GeneratedContent> {
  const prompt = GENERATION_PROMPT.replace(
    "{analysis}",
    JSON.stringify(analysis, null, 2)
  );

  const { content } = await chatWithFreeTextModels<GeneratedContent>({
    maxTokens: 1800,
    messages: [{ role: "user", content: prompt }],
  });

  return normalizeGeneratedContent(content);
}

export async function generateThumbnailImage(
  title: string,
  thumbnailText: string
): Promise<string | null> {
  const prompt = `Create a clean e-commerce product thumbnail image.
Product: ${title}
Overlay text concept: ${thumbnailText}
Style: modern, bright, professional product photo for online shopping.
No watermark, no logo text.`;

  const result = await generateImageWithFreeModels(prompt);
  return result?.url ?? null;
}

export async function generateFullProductPage(
  imageUrls: string[],
  productHint?: string
): Promise<{
  analysis: ProductAnalysis;
  content: GeneratedContent;
  thumbnailImageUrl: string | null;
  usedVisionFallback: boolean;
  generationSource: GenerationSource;
  warnings: string[];
}> {
  beginGenerationBudget();

  try {
    const warnings: string[] = [];
    let analysis: ProductAnalysis;
    let content: GeneratedContent;
    let usedVisionFallback = false;
    let generationSource: GenerationSource = "vision-combined";

    const combinedVision = await tryCombinedVision(imageUrls, productHint);

    if (combinedVision) {
      analysis = combinedVision.analysis;
      content = combinedVision.content;
      generationSource = "vision-combined";
    } else {
      const splitVision = await tryVisionAnalysisThenContent(
        imageUrls,
        productHint
      );

      if (splitVision) {
        analysis = splitVision.analysis;
        content = splitVision.content;
        generationSource = "vision-split";
      } else if (hasUsableHint(productHint)) {
        const hintResult = await tryCombinedHint(productHint!.trim());
        analysis = hintResult.data.analysis;
        content = hintResult.data.content;
        usedVisionFallback = true;
        generationSource = hintResult.offline ? "hint-offline" : "hint-ai";
        if (hintResult.offline) {
          warnings.push(
            "AI 생성에 실패해 기본 템플릿으로 대체되었습니다. 상품 힌트를 구체적으로 입력하거나 잠시 후 다시 시도해 주세요."
          );
        }
      } else {
        throw new Error(
          "이미지 분석에 실패했습니다. 1~2분 후 다시 시도하거나, 상품명/카테고리 힌트(예: 현대 SUV, 블랙)를 입력해 주세요."
        );
      }
    }

    let thumbnailImageUrl: string | null = null;
    if (isThumbnailImageEnabled()) {
      try {
        thumbnailImageUrl = await generateThumbnailImage(
          content.title,
          content.thumbnailText
        );
      } catch {
        thumbnailImageUrl = null;
      }
    }

    return {
      analysis,
      content,
      thumbnailImageUrl,
      usedVisionFallback,
      generationSource,
      warnings,
    };
  } finally {
    clearGenerationBudget();
  }
}
