import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isKvStorageEnabled } from "@/lib/storage-kv";
import { getStorageWarning } from "@/lib/storage-config";
import { imagesToDataUrls } from "@/lib/images";
import { saveProductThumbnail, toAbsoluteImageUrl } from "@/lib/image-store";
import { generateFullProductPage } from "@/lib/generation";
import { generateHtml, generateMarkdown } from "@/lib/export";
import { normalizeGeneratedContent } from "@/lib/normalize-content";
import {
  completeProduct,
  createProduct,
  failProduct,
  updateProductImages,
} from "@/lib/storage";

const generateSchema = z.object({
  productHint: z.string().max(200).optional(),
  imageUrls: z.array(z.string().min(1)).min(1).max(10).optional(),
  images: z
    .array(
      z.object({
        data: z.string().min(1),
        mimeType: z.string(),
        name: z.string(),
      })
    )
    .min(1)
    .max(10)
    .optional(),
});

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "잘못된 요청입니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    let imageUrls: string[] = [];

    if (parsed.data.images && parsed.data.images.length > 0) {
      imageUrls = imagesToDataUrls(parsed.data.images);
    } else if (parsed.data.imageUrls && parsed.data.imageUrls.length > 0) {
      imageUrls = parsed.data.imageUrls;
    } else {
      return NextResponse.json(
        { error: "이미지가 필요합니다." },
        { status: 400 }
      );
    }

    const product = await createProduct([]);

    let thumbnailPath: string;
    if (isKvStorageEnabled()) {
      // Redis에는 대용량 data URL을 저장하지 않음 (용량·타임아웃 방지)
      thumbnailPath = "";
    } else {
      thumbnailPath = await saveProductThumbnail(product.id, imageUrls[0]);
    }
    await updateProductImages(product.id, thumbnailPath ? [thumbnailPath] : []);

    try {
      const { analysis, content, thumbnailImageUrl, warnings } =
        await generateFullProductPage(imageUrls, parsed.data.productHint);

      const normalizedContent = normalizeGeneratedContent(content);

      const allWarnings = [...warnings];
      const storageWarning = getStorageWarning();
      if (storageWarning) {
        allWarnings.push(storageWarning);
      }

      const displayThumbnail =
        thumbnailPath || imageUrls[0];

      const displayImages = thumbnailImageUrl
        ? [thumbnailImageUrl, toAbsoluteImageUrl(displayThumbnail)]
        : displayThumbnail.startsWith("data:")
          ? [displayThumbnail]
          : displayThumbnail
            ? [toAbsoluteImageUrl(displayThumbnail)]
            : imageUrls;

      const htmlContent = generateHtml(normalizedContent, displayImages);
      const markdownContent = generateMarkdown(normalizedContent);

      const { page } = await completeProduct(product.id, {
        title: normalizedContent.title,
        analysis,
        page: {
          title: normalizedContent.title,
          description: normalizedContent.description,
          features: normalizedContent.features,
          faq: normalizedContent.faq,
          seo_keywords: normalizedContent.seoKeywords,
          thumbnail_text: normalizedContent.thumbnailText,
          marketing_copy: normalizedContent.marketingCopy,
          html_content: htmlContent,
          markdown_content: markdownContent,
        },
      });

      return NextResponse.json({
        success: true,
        productId: product.id,
        generatedPageId: page.id,
        content: normalizedContent,
        html: htmlContent,
        markdown: markdownContent,
        thumbnailImageUrl,
        imageUrl: displayThumbnail,
        warnings: allWarnings,
      });
    } catch (genError) {
      const message =
        genError instanceof Error ? genError.message : "생성 실패";
      await failProduct(product.id, message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
