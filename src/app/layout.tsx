import type { Metadata } from "next";
import DashboardNav from "@/components/DashboardNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "DetailMaster AI - AI 쇼핑 상세페이지 생성기",
  description:
    "상품 사진만 올리면 상세페이지 초안이 자동 생성됩니다. 스마트스토어, 쿠팡, 아마존 셀러를 위한 AI 도구.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <DashboardNav />
        <main className="flex-1 pb-16">{children}</main>
        <footer className="border-t border-[var(--color-border)] py-8">
          <div className="page-shell text-center text-sm text-[var(--color-ink-faint)]">
            DetailMaster AI · 스마트스토어 · 쿠팡 · 아마존 셀러를 위한 상세페이지 생성 도구
          </div>
        </footer>
      </body>
    </html>
  );
}
