"use client";

import { useState } from "react";
import Campo from "@/components/ui/Campo";
import { DEMO, supabase } from "@/lib/supabase";
import { normalizarPlaca, type OrdemServico } from "@/lib/tipos";

interface EditarDadosOSProps {
  os: OrdemServico;
  /** Chamado depois de salvar, com os campos já atualizados — quem usa
   * reflete na tela sem precisar recarregar a OS inteira. */
  onSalvo: (alteracoes: Partial<OrdemServico>) => void;
}

function formatarTelefone(digitos: string | null | undefined): string {
  const d = (digitos ?? "").replace(/\D/g, "");
  if (!d) return "";
  const nacional = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (nacional.length === 11) return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  if (nacional.length === 10) return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  return d;
}

/**
 * Cabeçalho da OS (cliente, WhatsApp, moto, km, reclamação) com edição
 * direta — pedido do Christian: errou o telefone na entrada e não tinha
 * como voltar pra corrigir. O WhatsApp cadastrado aqui é o número do
 * botão "Enviar para aprovação", então um número errado mandava o
 * orçamento pro lugar errado.
 *
 * Nome/telefone são do cliente e placa/marca/modelo são do veículo: a
 * correção vale pra todas as OS dele, não só esta (mesmo comportamento
 * da Entrada, que também atualiza o cliente existente).
 */
export default function EditarDadosOS({ os, onSalvo }: EditarDadosOSProps) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [placa, setPlaca] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [km, setKm] = useState("");
  const [relato, setRelato] = useState("");

  const abrir = () => {
    setNome(os.clientes?.nome ?? "");
    setTelefone(formatarTelefone(os.clientes?.telefone));
    setPlaca(os.veiculos?.placa ?? "");
    setMarca(os.veiculos?.marca ?? "");
    setModelo(os.veiculos?.modelo ?? "");
    setKm(os.km_entrada ? String(os.km_entrada) : "");
    setRelato(os.relato_cliente ?? "");
    setErro("");
    setEditando(true);
  };

  const salvar = async () => {
    const nomeLimpo = nome.trim();
    const telefoneDigitos = telefone.replace(/\D/g, "");
    const placaNormalizada = normalizarPlaca(placa);
    const kmNumero = km.replace(/\D/g, "") ? Number(km.replace(/\D/g, "")) : null;

    if (!nomeLimpo) {
      setErro("Informe o nome do cliente.");
      return;
    }
    if (telefoneDigitos && telefoneDigitos.length < 10) {
      setErro("WhatsApp incompleto — use DDD + número (ex.: 41 98888-7777).");
      return;
    }
    if (!placaNormalizada) {
      setErro("Informe a placa da moto.");
      return;
    }

    setSalvando(true);
    setErro("");

    const alteracoes: Partial<OrdemServico> = {
      km_entrada: kmNumero,
      relato_cliente: relato.trim() || null,
      clientes: { nome: nomeLimpo, telefone: telefoneDigitos || null },
      veiculos: {
        placa: placaNormalizada,
        marca: marca.trim() || null,
        modelo: modelo.trim() || null,
        ano: os.veiculos?.ano ?? null,
        fotos_url: os.veiculos?.fotos_url ?? null,
      },
    };

    if (DEMO || !supabase) {
      await new Promise((r) => setTimeout(r, 300));
      onSalvo(alteracoes);
      setSalvando(false);
      setEditando(false);
      return;
    }

    if (os.cliente_id) {
      const { error } = await supabase
        .from("clientes")
        .update({ nome: nomeLimpo, telefone: telefoneDigitos || null })
        .eq("id", os.cliente_id);
      if (error) {
        setErro("Não deu para salvar o cliente agora. Tente de novo.");
        setSalvando(false);
        return;
      }
    }

    const { error: erroVeiculo } = await supabase
      .from("veiculos")
      .update({ placa: placaNormalizada, marca: marca.trim() || null, modelo: modelo.trim() || null })
      .eq("id", os.veiculo_id);
    if (erroVeiculo) {
      setErro(
        erroVeiculo.code === "23505"
          ? "Já existe outra moto cadastrada com essa placa."
          : "Não deu para salvar a moto agora. Tente de novo.",
      );
      setSalvando(false);
      return;
    }

    const { error: erroOS } = await supabase
      .from("ordens_servico")
      .update({ km_entrada: kmNumero, relato_cliente: relato.trim() || null })
      .eq("id", os.id);
    if (erroOS) {
      setErro("Cliente e moto salvos, mas km e reclamação não. Tente de novo.");
      setSalvando(false);
      return;
    }

    onSalvo(alteracoes);
    setSalvando(false);
    setEditando(false);
  };

  if (editando) {
    return (
      <div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Nome do cliente" value={nome} onChange={setNome} placeholder="Nome" />
          <Campo
            label="WhatsApp"
            value={telefone}
            onChange={setTelefone}
            placeholder="41 98888-7777"
            inputMode="tel"
          />
          <Campo label="Placa" value={placa} onChange={(v) => setPlaca(v.toUpperCase())} placeholder="ABC-1D23" />
          <Campo label="Km na entrada" value={km} onChange={setKm} placeholder="12000" inputMode="numeric" />
          <Campo label="Marca" value={marca} onChange={setMarca} placeholder="Honda" />
          <Campo label="Modelo" value={modelo} onChange={setModelo} placeholder="CG 160" />
        </div>
        <label className="mt-3 block">
          <span className="mb-2 block text-[11px] uppercase tracking-wide text-zinc-500">Reclamação do cliente</span>
          <textarea
            value={relato}
            onChange={(e) => setRelato(e.target.value)}
            rows={3}
            className="campo-instrumento w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600"
          />
        </label>
        <p className="mt-2 text-[11px] text-zinc-600">
          Nome, WhatsApp e dados da moto valem para todas as OS desse cliente.
        </p>
        {erro && (
          <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{erro}</p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-md bg-amber-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-black transition-opacity disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            disabled={salvando}
            className="rounded-md border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-zinc-300 transition-colors hover:text-zinc-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  const telefoneFormatado = formatarTelefone(os.clientes?.telefone);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-100">{os.clientes?.nome ?? "Sem cliente"}</p>
          <p className="text-xs text-zinc-500">
            {telefoneFormatado ? `WhatsApp ${telefoneFormatado}` : "Sem WhatsApp cadastrado"}
          </p>
          <p className="text-xs text-zinc-500">
            {[os.veiculos?.marca, os.veiculos?.modelo, os.veiculos?.ano].filter(Boolean).join(" ")} · {os.veiculos?.placa}
          </p>
          {os.km_entrada && (
            <p className="mt-1 text-xs text-zinc-500">{os.km_entrada.toLocaleString("pt-BR")} km na entrada</p>
          )}
        </div>
        <button
          type="button"
          onClick={abrir}
          className="shrink-0 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-300 transition-colors hover:text-zinc-100"
        >
          Editar dados
        </button>
      </div>
      {os.relato_cliente && (
        <p className="mt-3 text-sm text-zinc-300">
          <span className="text-zinc-500">Reclamação: </span>
          {os.relato_cliente}
        </p>
      )}
    </div>
  );
}
