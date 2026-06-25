import { NextRequest, NextResponse } from "next/server";
import { readProductImage } from "@/lib/image-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string; fileName: string }> }
) {
  const { productId, fileName } = await params;
  const image = await readProductImage(productId, fileName);

  if (!image) {
    return NextResponse.json({ error: "이미지를 찾을 수 없습니다." }, { status: 404 });
  }

  return new NextResponse(image.buffer, {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
