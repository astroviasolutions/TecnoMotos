-- Vincula um item de OS (os_itens) ao produto do estoque que ele
-- representa — pedido do Christian: poder editar o nome/preço de uma
-- peça direto na OS e isso corrigir o cadastro no estoque todo, sem
-- precisar apagar e relançar o item. Sem essa coluna não tem como
-- saber a qual produto um item lançado se refere.
--
-- Opcional/degradável como as outras migrações deste projeto: até
-- rodar isso, lançar e editar itens continua funcionando normalmente
-- (o app tenta gravar com produto_id e cai pra só os campos antigos se
-- a coluna não existir) — só a parte de "editar aqui corrige no
-- estoque" é que fica pendente.

alter table os_itens add column if not exists produto_id uuid references produtos (id);
