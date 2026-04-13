-- Upload pelo navegador sem sessão Supabase Auth: o cliente usa só a chave anon (JWT role `anon`).
-- A migração anterior permitia INSERT só para `authenticated`; este admin ainda não faz login no Auth.
-- Quando implementar Auth no admin, você pode remover esta política e manter só insert para authenticated.
drop policy if exists "product_images_insert_anon" on storage.objects;

create policy "product_images_insert_anon"
on storage.objects for insert to anon
with check (bucket_id = 'product-images');
