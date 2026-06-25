"use client";

import { Download, Eye, FileCode, FileText } from "lucide-react";
import { downloadFile } from "@/lib/export";

interface ExportButtonsProps {
  html: string;
  markdown: string;
  title: string;
}

export default function ExportButtons({
  html,
  markdown,
  title,
}: ExportButtonsProps) {
  const safeName = (title ?? "product")
    .replace(/[^a-zA-Z0-9가-힣]/g, "_")
    .slice(0, 30);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() =>
          downloadFile(html, `${safeName}.html`, "text/html;charset=utf-8")
        }
        className="btn-primary text-sm py-2.5"
      >
        <FileCode className="h-4 w-4" />
        HTML
      </button>
      <button
        type="button"
        onClick={() =>
          downloadFile(
            markdown,
            `${safeName}.md`,
            "text/markdown;charset=utf-8"
          )
        }
        className="btn-accent"
      >
        <FileText className="h-4 w-4" />
        Markdown
      </button>
      <button
        type="button"
        onClick={() => {
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
        }}
        className="btn-secondary"
      >
        <Eye className="h-4 w-4" />
        미리보기
      </button>
      <button
        type="button"
        onClick={() =>
          downloadFile(html, `${safeName}.html`, "text/html;charset=utf-8")
        }
        className="btn-secondary sm:hidden"
      >
        <Download className="h-4 w-4" />
        저장
      </button>
    </div>
  );
}
