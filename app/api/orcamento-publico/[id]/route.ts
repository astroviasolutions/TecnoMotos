import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEMO } from "@/lib/supabase";
import { idDoLink } from "@/lib/idPublico";
import { ITENS_DEMO, ORDENS_DEMO } from "@/lib/dados-demo";

/**
 * Dados de uma OS pra a página pública de aprovação
 * (app/aprovar/[id]/page.tsx) — o cliente abre esse link pelo WhatsApp
 * sem estar logado, então essa rota roda com a chave secreta do
 * Supabase (mesmo padrão de app/api/criar-conta) em vez de depender de
 * RLS de sessão, e devolve só os campos que fazem sentido pro cliente
 * ver: nada de ids internos, custo de peça, ou dados de outros
 * clientes/veículos.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idBruto } = await params;
  const id = idDoLink(idBruto);

  if (DEMO) {
    const os = ORDENS_DEMO.find((o) => o.id === id);
    if (!os) return NextResponse.json({ erro: "Ordem de serviço não encontrada." }, { status: 404 });
    const itens = ITENS_DEMO.filter((i) => i.os_id === id);
    return NextResponse.json({
      os: {
        numero: os.numero,
        status: os.status,
        km_entrada: os.km_entrada,
        relato_cliente: os.relato_cliente,
        diagnostico: os.diagnostico,
        diagnostico_fotos: os.diagnostico_fotos ?? null,
        veiculos: os.veiculos,
        clientes: os.clientes,
        aprovado_por: os.aprovado_por ?? null,
        aprovado_cpf: os.aprovado_cpf ?? null,
        aprovado_em: os.aprovado_em ?? null,
      },
      itens,
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chaveSecreta = process.env.SUPABASE_SECRET_KEY;
  if (!url || !chaveSecreta) {
    return NextResponse.json({ erro: "Servidor sem a configuração do Supabase." }, { status: 500 });
  }
  const admin = createClient(url, chaveSecreta, { auth: { autoRefreshToken: false, persistSession: false } });

  const CAMPOS_BASE =
    "numero, status, valor_desconto, km_entrada, relato_cliente, diagnostico, veiculos(placa, marca, modelo, ano), clientes(nome, telefone)";

  // `aprovado_por`/`aprovado_cpf`/`aprovado_em` só existem depois da
  // migração opcional (supabase/2026-09-17-aprovacao-publica.sql) e
  // `diagnostico_fotos` só depois de outra (2026-09-18-diagnostico-
  // fotos.sql) — são independentes uma da outra, e pedir uma coluna que
  // não existe faz a consulta inteira falhar (undefined column). Em vez
  // de travar a página pública por causa de uma migração pendente,
  // tenta indo das 4 combinações possíveis (as duas, só uma, ou
  // nenhuma) até uma funcionar.
  const combinacoes = [
    `${CAMPOS_BASE}, diagnostico_fotos, aprovado_por, aprovado_cpf, aprovado_em`,
    `${CAMPOS_BASE}, aprovado_por, aprovado_cpf, aprovado_em`,
    `${CAMPOS_BASE}, diagnostico_fotos`,
    CAMPOS_BASE,
  ];
  let os: Record<string, unknown> | null = null;
  let erroOS: { message: string } | null = null;
  for (const campos of combinacoes) {
    const resultado = await admin.from("ordens_servico").select(campos).eq("id", id).single();
    if (!resultado.error) {
      os = resultado.data as unknown as Record<string, unknown>;
      erroOS = null;
      break;
    }
    erroOS = resultado.error;
  }
  if (erroOS || !os) {
    return NextResponse.json({ erro: "Ordem de serviço não encontrada." }, { status: 404 });
  }

  const { data: itens } = await admin
    .from("os_itens")
    .select("id, os_id, tipo, descricao, quantidade, valor_unit")
    .eq("os_id", id)
    .order("criado_em");

  return NextResponse.json({ os, itens: itens ?? [] });
}
