-- Permite apagar arquivo no Storage ao clicar em "Excluir imagem" no admin sem Auth (role anon).
drop policy if exists "product_images_delete_anon" on storage.objects;

create policy "product_images_delete_anon"
on storage.objects for delete to anon
using (bucket_id = 'product-images');
