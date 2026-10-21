"use client";

import { useState } from "react";
import TrailPlateButton from "@/components/TrailPlateButton";
import { DEMO, supabase } from "@/lib/supabase";
import { gerarPdfOrcamento } from "@/lib/gerarPdfOrcamento";
import { idParaLink } from "@/lib/idPublico";
import { brl, type ItemOS, type OrdemServico, type StatusOS } from "@/lib/tipos";

interface AprovacaoOSProps {
  os: OrdemServico;
  itens: ItemOS[];
  total: number;
  /** Chamado depois da OS avançar sozinha pra "aguardando_aprovacao" —
   * quem usa decide como refletir isso na tela (recarregar, etc.). */
  onStatusAtualizado?: (novoStatus: StatusOS) => void;
}

const STATUS_QUE_AVANCAM: StatusOS[] = ["recepcao", "diagnostico"];

/**
 * Botões pra levar o orçamento até o cliente aprovar/assinar — faltava
 * isso na tela (Christian: "não apareceu o botão para enviar a OS para
 * aprovação e assinatura do cliente").
 *
 * "Enviar para aprovação" abre o WhatsApp direto no número já
 * cadastrado do cliente (não um compartilhamento genérico onde ele
 * precisa escolher o contato à mão) com um link pra
 * `/aprovar/[id]` — uma página pública, sem login, no mesmo visual do
 * sistema, onde o cliente vê o orçamento, baixa o PDF e aprova. Era
 * pedido explícito do Christian: "mandar direto pro whats cadastrado
 * um link para ele assinar como se tivesse dentro do sistema e tbm o
 * PDF" — o link cobre as duas coisas (a tela pública tem o próprio
 * botão de baixar o PDF), então não precisa tentar anexar o arquivo
 * na mensagem (o que também não é confiável entre navegadores).
 *
 * "Baixar PDF" continua aqui, à parte, pro Christian imprimir na hora
 * se for o caso.
 *
 * Em qualquer um dos dois casos, se a OS ainda estiver em
 * "recepção"/"diagnóstico" ela avança sozinha pra "aguardando_aprovacao"
 * — status que já existia no pipeline (Trilha da Moto/Kanban) mas que
 * nada colocava a OS nele até agora.
 */
export default function AprovacaoOS({ os, itens, total, onStatusAtualizado }: AprovacaoOSProps) {
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const avancarParaAguardandoAprovacao = async () => {
    if (!STATUS_QUE_AVANCAM.includes(os.status)) return;
    if (DEMO || !supabase) {
      onStatusAtualizado?.("aguardando_aprovacao");
      return;
    }
    const { error } = await supabase.from("ordens_servico").update({ status: "aguardando_aprovacao" }).eq("id", os.id);
    if (!error) onStatusAtualizado?.("aguardando_aprovacao");
  };

  const nomeArquivo = `OS-${String(os.numero).padStart(4, "0")}-orcamento.pdf`;

  const baixarPdf = async () => {
    setGerando(true);
    setErro("");
    try {
      const blob = await gerarPdfOrcamento(os, itens, total);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivo;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Não deu para gerar o PDF agora.");
    } finally {
      setGerando(false);
    }
  };

  const enviarParaCliente = async () => {
    setErro("");
    const telefone = os.clientes?.telefone?.replace(/\D/g, "");
    if (!telefone) {
      setErro("Esse cliente não tem WhatsApp cadastrado — adicione o telefone antes de enviar.");
      return;
    }
    setEnviando(true);
    try {
      const linkPublico = `${window.location.origin}/aprovar/${idParaLink(os.id)}`;
      const texto =
        `Olá${os.clientes?.nome ? ", " + os.clientes.nome : ""}! Segue o orçamento da OS ${String(os.numero).padStart(
          4,
          "0",
        )} da TECNOMOTOS. Total: ${brl(total)}.\n\n` +
        `Veja os detalhes, baixe o PDF e aprove por aqui:\n${linkPublico}`;
      // Telefone já salvo com DDI 55 não pode ganhar outro 55.
      const numero = telefone.startsWith("55") && telefone.length >= 12 ? telefone : `55${telefone}`;
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
      await avancarParaAguardandoAprovacao();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
      <TrailPlateButton tamanho="sm" onClick={enviarParaCliente} disabled={enviando} className="flex-1">
        {enviando ? "Abrindo WhatsApp…" : "Enviar para aprovação"}
      </TrailPlateButton>
      <button
        type="button"
        onClick={baixarPdf}
        disabled={gerando}
        className="rounded-md border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-zinc-300 transition-colors hover:text-zinc-100"
      >
        {gerando ? "Gerando…" : "Baixar PDF"}
      </button>
      {erro && <p className="text-xs text-red-400 sm:basis-full">{erro}</p>}
    </div>
  );
}
