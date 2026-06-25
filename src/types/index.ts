export interface ProductAnalysis {
  category: string;
  productType: string;
  colors: string[];
  materials: string[];
  keyFeatures: string[];
  targetAudience: string;
  priceRange: string;
  brandStyle: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface GeneratedContent {
  title: string;
  description: string;
  features: string[];
  faq: FAQItem[];
  seoKeywords: string[];
  thumbnailText: string;
  marketingCopy: string;
}

export interface Product {
  id: string;
  title: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  image_urls: string[];
  analysis: ProductAnalysis | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeneratedPage {
  id: string;
  product_id: string;
  title: string;
  description: string;
  features: string[];
  faq: FAQItem[];
  seo_keywords: string[];
  thumbnail_text: string | null;
  marketing_copy: string | null;
  html_content: string | null;
  markdown_content: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateRequest {
  imageUrls: string[];
}

export interface GenerateResponse {
  success: boolean;
  productId: string;
  generatedPageId: string;
  content: GeneratedContent;
}
