-- InfinitePay como segundo meio de pagamento, ao lado da Stripe.
-- Rodar no SQL Editor. Idempotente. Aditiva: nada muda de comportamento.
--
-- POR QUE UM SEGUNDO PROVEDOR:
-- a Stripe nao entrega, no Brasil, parcelamento oferecido pelo lojista, e o Pix
-- dela e liberado so por convite. A InfinitePay tem Pix direto e ate 12x. O
-- site JA promete "10x de R$ 51,21" na pagina do quiz — promessa que hoje o
-- checkout nao cumpre.
--
-- O QUE MUDA NO MODELO DE CONFIANCA (e o ponto mais importante deste arquivo):
-- o webhook da InfinitePay NAO TEM ASSINATURA. Nem HMAC, nem header de origem,
-- nem segredo compartilhado. O corpo que chega e um JSON anonimo que qualquer
-- pessoa na internet pode postar — e o order_nsu viaja na URL de retorno, entao
-- o proprio cliente conhece o identificador do pedido dele.
--
-- Com a Stripe, `stripe.webhooks.constructEvent` prova a origem. Aqui nao ha
-- equivalente. A prova passa a ser uma chamada que o NOSSO servidor faz:
-- POST /payment_check. O webhook vira apenas um gatilho — "va conferir o
-- pedido X". Nada do corpo recebido decide dinheiro.
--
-- As colunas abaixo existem para sustentar esse desenho: guardar, no momento em
-- que criamos a cobranca, o identificador da fatura, para recusar depois
-- qualquer webhook que aponte para outra.

-- =====================================================================
-- 1) O provedor novo
-- =====================================================================
-- A constraint aparece em DOIS lugares no schema.sql: dentro do CREATE TABLE
-- (no-op em banco que ja existe) e num drop+add mais adiante, que e o valor
-- efetivo hoje. Os dois precisam ficar iguais, senao banco novo e producao
-- divergem.
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check
  check (provider in ('stripe', 'manual', 'infinitepay'));

-- Tira o default silencioso. Hoje um INSERT que esquecesse o campo gravaria
-- 'stripe' numa venda InfinitePay, e o painel mentiria sem ninguem perceber.
-- Com dois provedores, "esqueci de dizer qual" precisa falhar, nao adivinhar.
alter table public.payments alter column provider drop default;

-- capture_method da InfinitePay e 'credit_card' ou 'pix'. 'pix' ja existe;
-- faltava o cartao.
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in (
    'stripe', 'pix', 'boleto', 'dinheiro', 'transferencia', 'cartao', 'outro'
  ));

-- =====================================================================
-- 2) Correlacao com a InfinitePay
-- =====================================================================
-- Colunas proprias, e nao reaproveitamento das colunas da Stripe. Reaproveitar
-- funcionaria tecnicamente e envenenaria a operacao: o painel exibe esses
-- campos com rotulo de Stripe, e o atendente leria um transaction_nsu como se
-- fosse um payment_intent.
alter table public.payments
  add column if not exists infinitepay_invoice_slug text,
  add column if not exists infinitepay_transaction_nsu text,
  add column if not exists checkout_url text,
  add column if not exists receipt_url text;

comment on column public.payments.infinitepay_invoice_slug is
  'Identificador da fatura, gravado na CRIACAO do link. E a amarra contra replay: um webhook que aponte para outra fatura e recusado, mesmo trazendo transaction_nsu de um pagamento real.';
comment on column public.payments.infinitepay_transaction_nsu is
  'Identificador da transacao. Serve de chave de idempotencia — a InfinitePay nao manda id de evento, e order_nsu NAO serve porque e o mesmo nas duas cobrancas de um pagamento em dobro.';

-- Unicos parciais: a mesma transacao nunca pode ser contada em dois pagamentos.
create unique index if not exists payments_infinitepay_slug_key
  on public.payments(infinitepay_invoice_slug)
  where infinitepay_invoice_slug is not null;
create unique index if not exists payments_infinitepay_tx_key
  on public.payments(infinitepay_transaction_nsu)
  where infinitepay_transaction_nsu is not null;

-- =====================================================================
-- 3) A reserva precisa saber QUAL provedor abriu o checkout vivo
-- =====================================================================
-- Sem isto, o codigo que expira a sessao anterior antes de abrir outra chamaria
-- a API da Stripe com um identificador de link da InfinitePay.
--
-- checkout_url na reserva tem um segundo papel, especifico deste provedor: na
-- InfinitePay NAO EXISTE forma de invalidar um link ja criado. Como nao da para
-- matar o anterior, a defesa possivel e nao criar um segundo — devolver o mesmo
-- link enquanto o hold estiver de pe.
alter table public.bookings
  add column if not exists payment_provider text,
  add column if not exists infinitepay_invoice_slug text,
  add column if not exists checkout_url text;

alter table public.bookings drop constraint if exists bookings_payment_provider_check;
alter table public.bookings add constraint bookings_payment_provider_check
  check (payment_provider is null or payment_provider in ('stripe', 'infinitepay'));

create unique index if not exists bookings_infinitepay_slug_key
  on public.bookings(infinitepay_invoice_slug)
  where infinitepay_invoice_slug is not null;

-- =====================================================================
-- 4) A trava de eventos serve aos dois
-- =====================================================================
-- stripe_events tem event_id como chave primaria. Trocar por chave composta
-- exigiria drop de primary key numa tabela de trava de dinheiro — risco
-- desproporcional ao ganho. A chave passa a ser prefixada:
--   Stripe:      "evt_1A2b3C..."          (o event.id, como ja e)
--   InfinitePay: "infinitepay:<transaction_nsu>"
-- Colisao fica impossivel por construcao.
--
-- O nome da tabela passa a mentir sobre o conteudo. Renomear para
-- payment_events e mudanca boa, mas nao pertence ao caminho critico desta
-- entrega — fica registrado como divida.
comment on table public.stripe_events is
  'Eventos de pagamento ja processados, dos DOIS provedores. Stripe grava o event.id; InfinitePay grava "infinitepay:<transaction_nsu>", porque a API dela nao tem id de evento. O nome da tabela e historico: ela nao e mais so da Stripe.';

-- =====================================================================
-- 5) A RPC de pagamento manual precisa aceitar 'cartao'
-- =====================================================================
-- A lista de metodos esta repetida dentro da RPC. Sem atualizar aqui, o
-- operador que escolher "cartao" no painel manual toma INVALID_METHOD — a
-- constraint da tabela aceitaria, a funcao nao.
do $$
declare
  v_fonte text;
begin
  select pg_get_functiondef(p.oid)
    into v_fonte
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_confirm_manual_payment'
  limit 1;

  if v_fonte is null then
    raise notice 'admin_confirm_manual_payment nao existe; nada a fazer';
    return;
  end if;

  if position('''transferencia'',''cartao''' in v_fonte) > 0
     or position('''transferencia'', ''cartao''' in v_fonte) > 0 then
    raise notice 'admin_confirm_manual_payment ja aceita cartao';
    return;
  end if;

  execute replace(
    v_fonte,
    '''stripe'',''pix'',''boleto'',''dinheiro'',''transferencia'',''outro''',
    '''stripe'',''pix'',''boleto'',''dinheiro'',''transferencia'',''cartao'',''outro'''
  );

  raise notice 'admin_confirm_manual_payment passou a aceitar cartao';
end
$$;
