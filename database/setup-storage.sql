-- ================================================
-- CONFIGURAR SUPABASE STORAGE PARA ARCHIVOS DE AUDIO
-- ================================================

-- 1. Crear bucket para canciones (si no existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('songs', 'songs', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Crear bucket para imágenes de portada (si no existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas para el bucket de canciones
-- Permitir a cualquier usuario autenticado leer archivos
CREATE POLICY IF NOT EXISTS "Authenticated users can view songs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'songs');

-- Permitir a usuarios autenticados subir canciones
CREATE POLICY IF NOT EXISTS "Authenticated users can upload songs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'songs');

-- Solo admins pueden eliminar canciones
CREATE POLICY IF NOT EXISTS "Only admins can delete songs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'songs' AND
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  )
);

-- 4. Políticas para el bucket de covers
CREATE POLICY IF NOT EXISTS "Anyone can view covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'covers');

CREATE POLICY IF NOT EXISTS "Authenticated users can upload covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'covers');

CREATE POLICY IF NOT EXISTS "Only admins can delete covers"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'covers' AND
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  )
);

-- 5. Verificar que los buckets se crearon
SELECT id, name, public FROM storage.buckets WHERE id IN ('songs', 'covers');
