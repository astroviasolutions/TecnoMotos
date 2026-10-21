-- Pedido do Christian: "nao deixou a possibilidade de cadastrar novos
-- serviços" — até agora os botões de "Serviço rápido" (Troca de
-- óleo etc.) eram fixos no código. Esta tabela guarda os serviços que
-- a pessoa cadastra pela tela (Entrada rápida → "+ Novo serviço"),
-- além dos que já vêm prontos no sistema.
create table if not exists modelos_servico_rapido (
  id text primary key,
  nome text not null,
  itens jsonb not null,
  criado_em timestamptz not null default now()
);

alter table modelos_servico_rapido enable row level security;

create policy "Só quem está logado" on modelos_servico_rapido
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
