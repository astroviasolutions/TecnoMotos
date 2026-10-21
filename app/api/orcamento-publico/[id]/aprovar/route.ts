import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEMO } from "@/lib/supabase";
import { idDoLink } from "@/lib/idPublico";
import { ORDENS_DEMO } from "@/lib/dados-demo";
import { cpfValido, formatarCpf } from "@/lib/cpf";

/**
 * O cliente aprova o orçamento na página pública (app/aprovar/[id]) —
 * essa rota marca a OS como "aprovado". Guarda quem aprovou, o CPF de
 * quem assinou e quando em `aprovado_por`/`aprovado_cpf`/`aprovado_em`
 * — pedido do Christian: "depois de aprovado, e assinado com o nome e
 * cpf, pode colocar na OS para quando baixar já vir com a assinatura".
 * Essas colunas são novas e podem não existir ainda no banco de alguém
 * que não rodou a migração — por isso o fallback: se o update com elas
 * falhar por coluna inexistente, tenta de novo só com o status, pra
 * nunca travar a aprovação por causa de uma migração pendente (mesmo
 * espírito da mensagem de erro em app/ordens/[id]/page.tsx).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idBruto } = await params;
  const id = idDoLink(idBruto);

  let corpo: { nome?: string; cpf?: string };
  try {
    corpo = await req.json();
  } catch {
    corpo = {};
  }
  const nome = corpo.nome?.trim() || "";
  const cpf = (corpo.cpf ?? "").trim();

  if (!nome || !cpfValido(cpf)) {
    return NextResponse.json({ erro: "Informe o nome completo e um CPF válido para aprovar." }, { status: 400 });
  }
  const cpfFormatado = formatarCpf(cpf);

  if (DEMO) {
    const os = ORDENS_DEMO.find((o) => o.id === id);
    if (!os) return NextResponse.json({ erro: "Ordem de serviço não encontrada." }, { status: 404 });
    if (os.status === "cancelado" || os.status === "entregue") {
      return NextResponse.json({ erro: "Essa OS não está mais disponível para aprovação." }, { status: 409 });
    }
    // Modo demonstração não grava nada de verdade — só confirma a ação.
    return NextResponse.json({ ok: true });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chaveSecreta = process.env.SUPABASE_SECRET_KEY;
  if (!url || !chaveSecreta) {
    return NextResponse.json({ erro: "Servidor sem a configuração do Supabase." }, { status: 500 });
  }
  const admin = createClient(url, chaveSecreta, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: atual, error: erroAtual } = await admin.from("ordens_servico").select("status").eq("id", id).single();
  if (erroAtual || !atual) {
    return NextResponse.json({ erro: "Ordem de serviço não encontrada." }, { status: 404 });
  }
  if (atual.status === "cancelado" || atual.status === "entregue") {
    return NextResponse.json({ erro: "Essa OS não está mais disponível para aprovação." }, { status: 409 });
  }

  const { error: erroCompleto } = await admin
    .from("ordens_servico")
    .update({ status: "aprovado", aprovado_por: nome, aprovado_cpf: cpfFormatado, aprovado_em: new Date().toISOString() })
    .eq("id", id);

  if (erroCompleto) {
    // Coluna nova ainda não migrada nesse banco — grava pelo menos o status.
    const { error: erroSimples } = await admin.from("ordens_servico").update({ status: "aprovado" }).eq("id", id);
    if (erroSimples) {
      return NextResponse.json({ erro: erroSimples.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
