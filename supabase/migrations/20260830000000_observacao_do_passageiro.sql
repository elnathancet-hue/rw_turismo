-- Observação por passageiro.
-- Rodar no SQL Editor. Idempotente. Aditiva: nada muda de comportamento.
--
-- POR QUE ESTA COLUNA EXISTE:
-- a lista de passageiros que a agência mantém no Word carrega, dentro do nome,
-- pedidos que a operação precisa cumprir no dia: "quer os glampings mais
-- próximos do banheiro", "poltronas 33/34 ou na quarta fileira", "pg 04/09".
--
-- Sem lugar para guardar isso, a importação tinha duas saídas ruins: deixar o
-- pedido colado no nome (e o nome do passageiro vira uma frase) ou descartar em
-- silêncio (e o pedido some entre o Word e o ônibus). A coluna resolve as duas.
--
-- É texto livre de propósito. Padronizar em campos ("assento preferido",
-- "restrição alimentar") seria inventar uma taxonomia antes de saber o que a
-- operação realmente escreve ali.

alter table public.passengers
  add column if not exists notes text;

comment on column public.passengers.notes is
  'Pedido ou aviso sobre este passageiro, para a operação ver no dia: preferência de assento, de quarto, aviso de pagamento. Texto livre. Vem preenchido da importação da lista, quando a lista traz observação entre parênteses.';
