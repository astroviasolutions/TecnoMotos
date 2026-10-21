import { normalizarPlaca, type ItemOS, type MovimentoEstoque, type OrdemServico, type Produto } from "./tipos";

const horasAtras = (h: number) => new Date(Date.now() - h * 36e5).toISOString();

const VEICULOS = {
  v1: { placa: "ABC-1D23", marca: "VW", modelo: "Gol", ano: 2016, fotos_url: null },
  v2: { placa: "RXY-7H89", marca: "Chevrolet", modelo: "Onix", ano: 2020, fotos_url: null },
  v3: { placa: "BDX-4A17", marca: "Honda", modelo: "CG 160 Titan", ano: 2022, fotos_url: null },
};

const CLIENTES = {
  c1: { nome: "Rogério Baptista", telefone: "5541988887777" },
  c2: { nome: "Marina Vasques", telefone: "5541977776666" },
  c3: { nome: "Carlos Bittencourt", telefone: "5541998712230" },
};

export const ORDENS_DEMO: OrdemServico[] = [
  {
    id: "o1",
    numero: 1041,
    status: "em_execucao",
    km_entrada: 128500,
    relato_cliente: "Barulho na frente ao frear.",
    diagnostico: "Pastilhas dianteiras no limite e disco com sulco leve.",
    valor_pecas: 149,
    valor_servicos: 120,
    valor_desconto: 0,
    valor_total: 269,
    aberta_em: horasAtras(80),
    finalizada_em: null,
    entregue_em: null,
    veiculo_id: "v1",
    cliente_id: "c1",
    veiculos: VEICULOS.v1,
    clientes: CLIENTES.c1,
  },
  {
    id: "o2",
    numero: 1042,
    status: "aguardando_aprovacao",
    km_entrada: 61200,
    relato_cliente: "Revisão dos 60 mil.",
    diagnostico: null,
    valor_pecas: 81.9,
    valor_servicos: 350,
    valor_desconto: 0,
    valor_total: 431.9,
    aberta_em: horasAtras(30),
    finalizada_em: null,
    entregue_em: null,
    veiculo_id: "v2",
    cliente_id: "c2",
    veiculos: VEICULOS.v2,
    clientes: CLIENTES.c2,
  },
  {
    id: "o3",
    numero: 1043,
    status: "diagnostico",
    km_entrada: 18420,
    relato_cliente: "Ruído metálico no motor em marcha lenta.",
    diagnostico: null,
    valor_pecas: 0,
    valor_servicos: 0,
    valor_desconto: 0,
    valor_total: 0,
    aberta_em: horasAtras(3),
    finalizada_em: null,
    entregue_em: null,
    veiculo_id: "v3",
    cliente_id: "c3",
    veiculos: VEICULOS.v3,
    clientes: CLIENTES.c3,
  },
  {
    id: "o4",
    numero: 1039,
    status: "entregue",
    km_entrada: 59800,
    relato_cliente: "Troca de óleo.",
    diagnostico: "Óleo vencido, filtro saturado.",
    valor_pecas: 81.9,
    valor_servicos: 90,
    valor_desconto: 0,
    valor_total: 171.9,
    aberta_em: horasAtras(24 * 14),
    finalizada_em: horasAtras(24 * 13),
    entregue_em: horasAtras(24 * 13),
    veiculo_id: "v2",
    cliente_id: "c2",
    veiculos: VEICULOS.v2,
    clientes: CLIENTES.c2,
  },
  {
    id: "o5",
    numero: 1040,
    status: "finalizado",
    km_entrada: 127200,
    relato_cliente: "Bateria arriando.",
    diagnostico: "Bateria sem carga, alternador ok.",
    valor_pecas: 459,
    valor_servicos: 80,
    valor_desconto: 20,
    valor_total: 519,
    aberta_em: horasAtras(24 * 5),
    finalizada_em: horasAtras(24 * 4),
    entregue_em: null,
    veiculo_id: "v1",
    cliente_id: "c1",
    veiculos: VEICULOS.v1,
    clientes: CLIENTES.c1,
  },
];

export const ITENS_DEMO: ItemOS[] = [
  { id: "i1", os_id: "o1", tipo: "peca", descricao: "Pastilha de freio dianteira", quantidade: 1, valor_unit: 149, produto_id: "p3" },
  { id: "i2", os_id: "o1", tipo: "servico", descricao: "Troca de pastilhas dianteiras", quantidade: 1, valor_unit: 120 },
  { id: "i3", os_id: "o2", tipo: "peca", descricao: "Óleo 5W30 sintético 1L", quantidade: 1, valor_unit: 49.9, produto_id: "p1" },
  { id: "i4", os_id: "o2", tipo: "peca", descricao: "Filtro de óleo", quantidade: 1, valor_unit: 32, produto_id: "p2" },
  { id: "i5", os_id: "o2", tipo: "servico", descricao: "Revisão completa", quantidade: 1, valor_unit: 350 },
];

/** Histórico de uma placa em modo demonstração — usado pela Entrada de
 * Veículo pra simular o mesmo lookup que a versão real faz no
 * Supabase (ver app/entrada/page.tsx, `consultarPlaca`). Reaproveita
 * as próprias ORDENS_DEMO em vez de manter uma segunda lista separada
 * de veículos/histórico. */
export function buscarHistoricoDemoPorPlaca(placa: string) {
  const alvo = normalizarPlaca(placa);
  const doVeiculo = ORDENS_DEMO.filter((os) => normalizarPlaca(os.veiculos?.placa ?? "") === alvo);
  if (doVeiculo.length === 0) return null;
  const [maisRecente] = [...doVeiculo].sort((a, b) => +new Date(b.aberta_em) - +new Date(a.aberta_em));
  return {
    veiculo: { id: maisRecente.veiculo_id, ...maisRecente.veiculos! },
    cliente: { id: maisRecente.cliente_id, ...maisRecente.clientes! },
    historico: doVeiculo
      .map((os) => ({ id: os.id, numero: os.numero, status: os.status, aberta_em: os.aberta_em, valor_total: os.valor_total }))
      .sort((a, b) => +new Date(b.aberta_em) - +new Date(a.aberta_em)),
  };
}

export const PRODUTOS_DEMO: Produto[] = [
  { id: "p1", nome: "Óleo 5W30 sintético 1L", sku: "OL-5W30", preco_venda: 49.9, preco_custo: 28, estoque_min: 12, unidade: "UN", ativo: true, saldo: 22, situacao: "ok" },
  { id: "p2", nome: "Filtro de óleo", sku: "FO-001", preco_venda: 32, preco_custo: 15, estoque_min: 6, unidade: "UN", ativo: true, saldo: 4, situacao: "critico" },
  { id: "p3", nome: "Pastilha de freio dianteira", sku: "PF-D01", preco_venda: 149, preco_custo: 78, estoque_min: 4, unidade: "JG", ativo: true, saldo: 0, situacao: "zerado" },
  { id: "p4", nome: "Bateria 60Ah", sku: "BAT-60", preco_venda: 459, preco_custo: 290, estoque_min: 2, unidade: "UN", ativo: true, saldo: 3, situacao: "ok" },
];

/** Saídas de peça por OS em modo demonstração — o que o Dashboard soma
 * pra mostrar "Peças que saíram" e o ranking de mais usadas (ver
 * app/dashboard/page.tsx). Espelha o que `estoque_movimentos` guardaria
 * de verdade no Supabase (tipo "saida_os", sem custo_unit — o mesmo
 * lançamento feito em app/ordens/[id]/page.tsx), já com o nome do
 * produto embutido (`produtos: { nome }`) do jeito que a consulta real
 * devolve via `.select("...produtos(nome)")`. */
function movimentoDemo(
  id: string,
  produtoId: keyof typeof PRODUTOS_POR_ID,
  quantidade: number,
  criadoEm: string,
): MovimentoEstoque {
  return {
    id,
    produto_id: produtoId,
    tipo: "saida_os",
    quantidade,
    criado_em: criadoEm,
    produtos: { nome: PRODUTOS_POR_ID[produtoId].nome },
  };
}

const PRODUTOS_POR_ID = {
  p1: { nome: "Óleo 5W30 sintético 1L" },
  p2: { nome: "Filtro de óleo" },
  p3: { nome: "Pastilha de freio dianteira" },
  p4: { nome: "Bateria 60Ah" },
};

export const MOVIMENTOS_DEMO: MovimentoEstoque[] = [
  movimentoDemo("m1", "p3", 1, horasAtras(80)),
  movimentoDemo("m2", "p1", 1, horasAtras(30)),
  movimentoDemo("m3", "p2", 1, horasAtras(30)),
  movimentoDemo("m4", "p1", 4, horasAtras(24 * 4)),
  movimentoDemo("m5", "p2", 3, horasAtras(24 * 4)),
  movimentoDemo("m6", "p4", 1, horasAtras(24 * 4)),
  movimentoDemo("m7", "p1", 1, horasAtras(24 * 13)),
];
