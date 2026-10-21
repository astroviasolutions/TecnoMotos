export type StatusOS =
  | "recepcao"
  | "diagnostico"
  | "aguardando_aprovacao"
  | "aprovado"
  | "em_execucao"
  | "aguardando_peca"
  | "finalizado"
  | "entregue"
  | "cancelado";

export const STATUS_LABEL: Record<StatusOS, string> = {
  recepcao: "Recepção",
  diagnostico: "Diagnóstico",
  aguardando_aprovacao: "Aguardando cliente",
  aprovado: "Aprovado",
  em_execucao: "Em execução",
  aguardando_peca: "Aguardando peça",
  finalizado: "Finalizado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

/** Cor por família de status — ciano (diagnóstico), laranja (esperando
 * algo), roxo (em movimento), verde (concluído). */
export const STATUS_COR: Record<StatusOS, string> = {
  recepcao: "34 211 238",
  diagnostico: "34 211 238",
  aguardando_aprovacao: "251 146 60",
  aprovado: "168 85 247",
  em_execucao: "168 85 247",
  aguardando_peca: "251 146 60",
  finalizado: "74 222 128",
  entregue: "74 222 128",
  cancelado: "248 113 113",
};

/** Mesmas cores de STATUS_COR, só que na variante escura (~700) usada
 * quando a cor aparece como TEXTO/preenchimento sólido em cima de um
 * fundo claro — as tonalidades ~400 de STATUS_COR são pensadas pra
 * fundo escuro (badge, faixa lateral, glow) e ficam com contraste ruim
 * como texto direto em tema claro. Usado só onde a cor vira texto ou
 * bolinha sólida (BadgeStatus, Trilha da Moto, Dashboard) — fundos e
 * bordas translúcidas continuam com a cor original nos dois temas. */
const STATUS_COR_TEXTO_CLARO: Record<string, string> = {
  "34 211 238": "14 116 144", // cyan-700
  "251 146 60": "194 65 12", // orange-700
  "168 85 247": "126 34 206", // purple-700
  "74 222 128": "21 128 61", // green-700
  "248 113 113": "185 28 28", // red-700
  "161 161 170": "82 82 91", // zinc-600 (usado por indicadores neutros, ex.: "no prazo")
};

export function corStatusTexto(cor: string, tema: "escuro" | "claro"): string {
  if (tema === "claro") return STATUS_COR_TEXTO_CLARO[cor] ?? cor;
  return cor;
}

export const COLUNAS_KANBAN: StatusOS[] = [
  "recepcao",
  "diagnostico",
  "aguardando_aprovacao",
  "aprovado",
  "em_execucao",
  "aguardando_peca",
  "finalizado",
];

export interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
}

export interface Veiculo {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  km_atual: number | null;
  documento: string | null;
  /** URLs públicas das fotos gerais da moto (bucket "veiculos-fotos"),
   * tiradas na Entrada de Veículo — o "arquivo do cliente" que faltava. */
  fotos_url: string[] | null;
}

export interface OrdemServico {
  id: string;
  numero: number;
  status: StatusOS;
  km_entrada: number | null;
  relato_cliente: string | null;
  diagnostico: string | null;
  /** Fotos do problema encontrado, anexadas ao gravar o diagnóstico
   * (`app/ordens/[id]/page.tsx`) — pedido do Christian: poder registrar
   * o que foi o problema "por foto se necessário" pra mandar junto do
   * diagnóstico pro cliente aprovar/assinar. Opcional porque só existe
   * depois de rodar `supabase/2026-09-18-diagnostico-fotos.sql`. */
  diagnostico_fotos?: string[] | null;
  valor_pecas: number;
  valor_servicos: number;
  valor_desconto: number;
  valor_total: number;
  aberta_em: string;
  finalizada_em: string | null;
  entregue_em: string | null;
  veiculo_id: string;
  cliente_id: string | null;
  veiculos?: Pick<Veiculo, "placa" | "marca" | "modelo" | "ano" | "fotos_url"> | null;
  clientes?: Pick<Cliente, "nome" | "telefone"> | null;
  /** Preenchidos quando o cliente aprova pela página pública
   * (app/aprovar/[id]) — opcionais porque só existem depois de rodar
   * `supabase/2026-09-17-aprovacao-publica.sql`, e uma OS ainda não
   * aprovada não tem nada aqui. */
  aprovado_por?: string | null;
  aprovado_cpf?: string | null;
  aprovado_em?: string | null;
}

export interface ItemOS {
  id: string;
  os_id: string;
  tipo: "peca" | "servico";
  descricao: string;
  quantidade: number;
  valor_unit: number;
  /** Produto do estoque que esta peça representa (null pra serviço/mão
   * de obra, ou pra uma peça descrita manualmente sem vínculo). Editar
   * nome/preço de um item com produto_id também atualiza o produto no
   * estoque — ver supabase/2026-10-20-item-produto-vinculo.sql.
   * Opcional porque só existe depois dessa migração rodar. */
  produto_id?: string | null;
}

/** Só os campos que o PDF do orçamento (lib/gerarPdfOrcamento.ts) de
 * fato usa — `OrdemServico` completa satisfaz isso naturalmente
 * (estrutural), mas a página pública de aprovação (app/aprovar/[id])
 * busca os dados por uma API própria que devolve só isso, sem os
 * campos internos (ids, valor_pecas/servicos/desconto etc.) — não
 * precisa fingir ser uma `OrdemServico` completa só pra gerar o PDF. */
export interface DadosOSParaPdf {
  numero: number;
  /** Desconto dado na OS (R$) — opcional pra não quebrar consultas antigas. */
  valor_desconto?: number | null;
  km_entrada: number | null;
  relato_cliente: string | null;
  diagnostico: string | null;
  diagnostico_fotos?: string[] | null;
  veiculos?: Pick<Veiculo, "placa" | "marca" | "modelo" | "ano"> | null;
  clientes?: Pick<Cliente, "nome" | "telefone"> | null;
  /** Presentes quando a OS já foi aprovada/assinada pelo cliente na
   * página pública — o PDF usa isso pra imprimir a assinatura já
   * preenchida em vez da linha em branco. */
  aprovado_por?: string | null;
  aprovado_cpf?: string | null;
  aprovado_em?: string | null;
}

/** Um lançamento de `estoque_movimentos` — usado pelo Dashboard pra
 * contar quantas peças saíram (tipo "saida_os") num período. */
export interface MovimentoEstoque {
  id: string;
  produto_id: string;
  tipo: "entrada_nf" | "entrada_manual" | "saida_os" | "saida_venda" | "devolucao" | "ajuste";
  quantidade: number;
  criado_em: string;
  produtos?: Pick<Produto, "nome"> | null;
}

export interface Produto {
  id: string;
  nome: string;
  sku: string | null;
  preco_venda: number;
  preco_custo: number;
  estoque_min: number;
  unidade: string;
  ativo: boolean;
  saldo: number;
  situacao: "ok" | "critico" | "zerado";
}

export function brl(valor: number | null | undefined): string {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Horas parado vira nível de urgência (0 a 3), igual ao app original. */
export function urgencia(os: Pick<OrdemServico, "status" | "aberta_em">): 0 | 1 | 2 | 3 {
  if (["entregue", "cancelado", "finalizado"].includes(os.status)) return 0;
  const horas = (Date.now() - new Date(os.aberta_em).getTime()) / 36e5;
  if (horas > 72) return 3;
  if (horas > 24) return 2;
  return 1;
}

/** Normaliza uma placa digitada (com ou sem traço, minúscula, com
 * espaço) pro mesmo formato usado no banco/telas ("ABC-1D23") — usada
 * na Entrada de Veículo pra reconhecer uma placa já cadastrada não
 * importa como a pessoa digitou. Cobre só o padrão de 7 caracteres
 * (antigo ou Mercosul); qualquer coisa fora disso volta em maiúsculo,
 * sem traço, pra pelo menos comparar de forma consistente. */
export function normalizarPlaca(valor: string): string {
  const limpa = valor.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (limpa.length === 7) return `${limpa.slice(0, 3)}-${limpa.slice(3)}`;
  return limpa;
}
