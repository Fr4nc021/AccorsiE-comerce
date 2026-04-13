-- Bucket público para imagens de produto (upload com sessão Supabase Auth).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_images_select_public" on storage.objects;
drop policy if exists "product_images_insert_authenticated" on storage.objects;
drop policy if exists "product_images_update_authenticated" on storage.objects;
drop policy if exists "product_images_delete_authenticated" on storage.objects;

create policy "product_images_select_public"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "product_images_insert_authenticated"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images');

create policy "product_images_update_authenticated"
on storage.objects for update to authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

create policy "product_images_delete_authenticated"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images');
