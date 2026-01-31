-- Verify and create RLS policies for covers bucket
-- Run this in Supabase SQL Editor

-- 1. First, check if policies exist for covers bucket
SELECT
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%covers%';

-- 2. If no policies exist, create them (same as songs bucket)

-- Delete existing covers policies (if needed)
DROP POLICY IF EXISTS "Authenticated users can read covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete covers" ON storage.objects;

-- Create READ policy for covers bucket
CREATE POLICY "Authenticated users can read covers"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'covers');

-- Create INSERT policy for covers bucket
CREATE POLICY "Authenticated users can upload covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'covers');

-- Create UPDATE policy for covers bucket
CREATE POLICY "Authenticated users can update covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'covers')
WITH CHECK (bucket_id = 'covers');

-- Create DELETE policy for covers bucket (optional - for admins)
CREATE POLICY "Authenticated users can delete covers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'covers');

-- 3. Verify the bucket configuration
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'covers';

-- NOTE: The covers bucket should be:
-- - public = false (private bucket)
-- - allowed_mime_types should include image types: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']

-- 4. If bucket doesn't exist or needs update, run:
-- UPDATE storage.buckets
-- SET public = false,
--     allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
-- WHERE name = 'covers';
