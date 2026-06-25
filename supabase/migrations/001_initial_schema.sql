-- DetailMaster AI - Initial Schema
-- Run this migration in Supabase SQL Editor or via Supabase CLI

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products table: stores uploaded product info
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  analysis JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generated pages table: stores AI-generated content
CREATE TABLE IF NOT EXISTS generated_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  features TEXT[] NOT NULL DEFAULT '{}',
  faq JSONB NOT NULL DEFAULT '[]',
  seo_keywords TEXT[] NOT NULL DEFAULT '{}',
  thumbnail_text TEXT,
  marketing_copy TEXT,
  html_content TEXT,
  markdown_content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_pages_product_id ON generated_pages(product_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_pages_updated_at
  BEFORE UPDATE ON generated_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for product images (run in Supabase Dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- RLS policies (open for MVP - tighten for production with auth)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read products" ON products
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert products" ON products
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update products" ON products
  FOR UPDATE USING (true);

CREATE POLICY "Allow public read generated_pages" ON generated_pages
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert generated_pages" ON generated_pages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update generated_pages" ON generated_pages
  FOR UPDATE USING (true);

-- Storage policies for product-images bucket
-- CREATE POLICY "Public read product images" ON storage.objects
--   FOR SELECT USING (bucket_id = 'product-images');
-- CREATE POLICY "Public upload product images" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'product-images');
