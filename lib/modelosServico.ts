/**
 * Modelos de serviço rápido — pedido do Christian: "fazer a troca de
 * óleo e já sair a NF do cliente, sem ter que autorizar". Em vez do
 * fluxo normal (lançar item por item, mandar pro WhatsApp do cliente
 * aprovar/assinar), um clique aqui já lança o pacote de itens inteiro
 * E pula direto pra "aprovado" — sem esperar autorização do cliente.
 *
 * `valorPadrao` só é usado quando o item é um serviço (mão de obra,
 * que não existe no estoque) ou quando a peça não tem um produto
 * correspondente cadastrado no estoque — se houver (por nome, ver
 * `aplicarModeloRapido` em app/ordens/[id]/page.tsx), o preço real do
 * estoque é usado no lugar, e a peça fica vinculada a ele (então editar
 * o item depois, na OS, também corrige o preço no estoque — ver
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
