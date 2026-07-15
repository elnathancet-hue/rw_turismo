-- Aparência por página: escolher o topo (menu do site / simples / nenhum) e
-- mostrar/ocultar o rodapé. Idempotente.

alter table public.pages
  add column if not exists header_style text not null default 'simple',
  add column if not exists show_footer boolean not null default true;

alter table public.pages
  drop constraint if exists pages_header_style_check;
alter table public.pages
  add constraint pages_header_style_check
  check (header_style in ('site', 'simple', 'none'));
