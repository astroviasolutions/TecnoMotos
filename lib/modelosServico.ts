import type { Produto } from "./tipos";

/**
 * Modelos de serviço rápido — pedido do Christian: "fazer a troca de
 * óleo e já sair a NF do cliente, sem ter que autorizar". Em vez do
 * fluxo normal (lançar item por item, mandar pro WhatsApp do cliente
 * aprovar/assinar), um clique aqui já lança o pacote de itens inteiro
 * E pula direto pra "aprovado" — sem esperar autorização do cliente.
 * Usado tanto dentro de uma OS já aberta (app/ordens/[id]/page.tsx)
 * quanto na Entrada rápida (app/entrada-rapida/page.tsx), que já abre
 * a OS com o modelo aplicado — pedido do Christian: "precisa ser na
 * tela inicial, para... abertura de uma OS rápida".
 *
 * `valorPadrao` só é usado quando o item é um serviço (mão de obra,
 * que não existe no estoque) ou quando a peça não tem um produto
 * correspondente cadastrado no estoque — se houver (por nome, ver
 * `resolverItensModelo` abaixo), o preço real do estoque é usado no
 * lugar, e a peça fica vinculada a ele (então editar o item depois,
 * na OS, também corrige o preço no estoque — ver
 * supabase/2026-10-20-item-produto-vinculo.sql).
 *
 * Pra adicionar um modelo novo (ex.: "Troca de pneu", "Revisão
 * básica"), basta acrescentar um item neste array — nenhum outro
 * arquivo precisa mudar.
 */
export interface ItemModeloServico {
  tipo: "peca" | "servico";
  descricao: string;
  quantidade: number;
  valorPadrao: number;
}

export interface ModeloServicoRapido {
  id: string;
  nome: string;
  itens: ItemModeloServico[];
}

export const MODELOS_SERVICO_RAPIDO: ModeloServicoRapido[] = [
  {
    id: "troca-oleo",
    nome: "Troca de óleo",
    itens: [
      { tipo: "peca", descricao: "Óleo 5W30 sintético 1L", quantidade: 1, valorPadrao: 49.9 },
      { tipo: "peca", descricao: "Filtro de óleo", quantidade: 1, valorPadrao: 32 },
      { tipo: "servico", descricao: "Mão de obra — troca de óleo", quantidade: 1, valorPadrao: 40 },
    ],
  },
];

export interface ItemModeloResolvido {
  tipo: "peca" | "servico";
  descricao: string;
  quantidade: number;
  valor_unit: number;
  produto_id: string | null;
}

/** Casa cada item do modelo com o produto do estoque de mesmo nome
 * (peça com correspondência usa o preço real e fica vinculada a ele;
 * sem correspondência, ou sendo mão de obra, usa o valor padrão do
 * modelo e segue sem vínculo). Compartilhado entre a OS normal e a
 * Entrada rápida pra não duplicar essa regra nos dois lugares. */
export function resolverItensModelo(modelo: ModeloServicoRapido, produtos: Produto[]): ItemModeloResolvido[] {
  return modelo.itens.map((it) => {
    if (it.tipo !== "peca") return { tipo: it.tipo, descricao: it.descricao, quantidade: it.quantidade, valor_unit: it.valorPadrao, produto_id: null };
    const produto = produtos.find((p) => p.nome.trim().toLowerCase() === it.descricao.trim().toLowerCase());
    return {
      tipo: it.tipo,
      descricao: produto?.nome ?? it.descricao,
      quantidade: it.quantidade,
      valor_unit: produto?.preco_venda ?? it.valorPadrao,
      produto_id: produto?.id ?? null,
    };
  });
}

/** Soma peças/serviços de uma lista já resolvida — usado pela Entrada
 * rápida pra montar os valores da OS nova (sem desconto, sem itens
 * anteriores, diferente de `somarItens` em app/ordens/[id]/page.tsx). */
export function totalizarItensResolvidos(itens: ItemModeloResolvido[]) {
  const valor_pecas = itens.filter((i) => i.tipo === "peca").reduce((s, i) => s + i.quantidade * i.valor_unit, 0);
  const valor_servicos = itens.filter((i) => i.tipo === "servico").reduce((s, i) => s + i.quantidade * i.valor_unit, 0);
  return { valor_pecas, valor_servicos, valor_total: valor_pecas + valor_servicos };
}
