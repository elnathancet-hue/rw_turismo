-- Acesso à reserva sem sessão (compra sem cadastro). Rodar no SQL Editor.
--
-- A compra sem cadastro cria a conta do cliente nos bastidores, mas o navegador
-- dele NÃO fica logado. Como /account/bookings/[id] exige sessão, o convidado
-- criava a reserva e batia num muro de login antes de pagar — a vaga ficava
-- retida por 30 minutos e a venda morria ali.
--
-- A saída é um token de acesso por reserva: um segredo aleatório que vai na URL
-- de retorno e vale só para AQUELA reserva. Não é sessão, não dá acesso a mais
-- nada e não afrouxa nenhuma policy.
--
-- POR QUE NÃO LOGAR O CONVIDADO AUTOMATICAMENTE: seria abrir sessão a partir de
-- um e-mail digitado. Quem soubesse o e-mail de outra pessoa entraria na conta
-- dela. O token resolve o acesso à reserva sem tocar em autenticação.
--
-- POR QUE NÃO CONFIAR SÓ NO id DA RESERVA: o uuid já é difícil de adivinhar,
-- mas ele aparece em log de servidor, histórico de navegador e link
-- compartilhado. Um segredo separado pode ser trocado sem trocar a reserva.

alter table public.bookings
  add column if not exists access_token text;

-- Índice único parcial: reservas antigas ficam com token nulo e não brigam
-- entre si pela unicidade.
create unique index if not exists bookings_access_token_key
  on public.bookings(access_token)
  where access_token is not null;

-- Gerado por trigger, e não dentro da RPC de reserva, de propósito: assim vale
-- também para reserva manual criada pelo admin, e a RPC (que já é longa) não
-- precisa ser reescrita de novo só por causa disto.
create or replace function public.set_booking_access_token()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.access_token is null then
    -- 24 bytes = 48 caracteres hex. Aleatoriedade criptográfica do pgcrypto.
    new.access_token := encode(gen_random_bytes(24), 'hex');
  end if;
  return new;
end;
$$;

drop trigger if exists set_bookings_access_token on public.bookings;
create trigger set_bookings_access_token
before insert on public.bookings
for each row execute function public.set_booking_access_token();

-- Preenche o que já existe, para reservas antigas também poderem receber link.
update public.bookings
set access_token = encode(gen_random_bytes(24), 'hex')
where access_token is null;

comment on column public.bookings.access_token is
  'Segredo por reserva usado no link de acesso do convidado (?t=). Nunca é exposto em listagem: só volta para quem acabou de criar a reserva.';
