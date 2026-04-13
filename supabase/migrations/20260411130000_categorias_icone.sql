-- Ícone opcional: URL (https://…) ou caminho público (ex.: /icons/freios.svg → arquivo em public/).

alter table public.categorias add column if not exists icone text;

comment on column public.categorias.icone is 'URL absoluta ou caminho começando com /';
