-- Modo HTML nas páginas: o admin cola um HTML completo e a página publica
-- exatamente esse HTML (com ou sem o menu/rodapé do site). Idempotente.

alter table public.pages
  add column if not exists custom_html text,
  add column if not exists custom_html_chrome boolean not null default false;
