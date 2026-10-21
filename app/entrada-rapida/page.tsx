"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PainelVidro from "@/components/ui/PainelVidro";
import Campo from "@/components/ui/Campo";
import TrailPlateButton from "@/components/TrailPlateButton";
import { DEMO, supabase } from "@/lib/supabase";
import { buscarHistoricoDemoPorPlaca, PRODUTOS_DEMO } from "@/lib/dados-demo";
import {
  MODELOS_SERVICO_RAPIDO,
  carregarModelosPersonalizados,
  removerModeloPersonalizado,
  resolverItensModelo,
  salvarModeloPersonalizado,
  totalizarItensResolvidos,
  type ItemModeloServico,
  type ModeloServicoRapido,
} from "@/lib/modelosServico";
import { brl, normalizarPlaca, type Produto } from "@/lib/tipos";

interface VeiculoConhecido {
  veiculoId: string;
  clienteId: string;
  nome: string;
  telefone: string | null;
}

/**
 * Entrada rápida — pedido do Christian: "o serviço rápido precisa ser
 * na tela inicial, para serviços que chegam para uma passada rápida
 * na oficina, no caso abertura de uma OS rápida". Diferente da Entrada
 * normal (app/entrada/page.tsx — câmera, fotos, diagnóstico depois),
 * aqui é só placa + cliente + escolher o serviço: a OS já nasce com os
 * itens lançados, aprovada, pronta pra baixar o PDF.
 */
export default function EntradaRapidaPage() {
  const router = useRouter();
  const [placa, setPlaca] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [avisoDemo, setAvisoDemo] = useState(false);

  const [consultandoPlaca, setConsultandoPlaca] = useState(false);
  const [conhecido, setConhecido] = useState<VeiculoConhecido | null>(null);
  const [placaConsultada, setPlacaConsultada] = useState("");

  // Serviços cadastrados pela pessoa — pedido do Christian: "não
  // deixou a possibilidade de cadastrar novos serviços".
  const [modelosPersonalizados, setModelosPersonalizados] = useState<ModeloServicoRapido[]>([]);
  const [cadastrandoServico, setCadastrandoServico] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novosItens, setNovosItens] = useState<ItemModeloServico[]>([{ tipo: "servico", descricao: "", quantidade: 1, valorPadrao: 0 }]);
  const [salvandoServico, setSalvandoServico] = useState(false);

  const recarregarModelos = () => carregarModelosPersonalizados().then(setModelosPersonalizados);
  useEffect(() => {
    recarregarModelos();
  }, []);

  const todosModelos = [...MODELOS_SERVICO_RAPIDO, ...modelosPersonalizados];

  const atualizarNovoItem = (i: number, campo: keyof ItemModeloServico, valor: string) => {
    setNovosItens((atual) =>
      atual.map((it, idx) =>
        idx !== i
          ? it
          : { ...it, [campo]: campo === "quantidade" || campo === "valorPadrao" ? Number(valor.replace(",", ".")) || 0 : valor },
      ),
    );
  };

  const salvarNovoServico = async () => {
    const itensValidos = novosItens.filter((it) => it.descricao.trim());
    if (!novoNome.trim() || itensValidos.length === 0) return;
    setSalvandoServico(true);
    const modelo: ModeloServicoRapido = {
      id: `custom-${Date.now()}`,
      nome: novoNome.trim(),
      itens: itensValidos,
    };
    await salvarModeloPersonalizado(modelo);
    await recarregarModelos();
    setNovoNome("");
    setNovosItens([{ tipo: "servico", descricao: "", quantidade: 1, valorPadrao: 0 }]);
    setCadastrandoServico(false);
    setSalvandoServico(false);
  };

  const excluirServico = async (idParaExcluir: string) => {
    await removerModeloPersonalizado(idParaExcluir);
    await recarregarModelos();
    if (modeloId === idParaExcluir) setModeloId(null);
  };

  // Preços reais do estoque pra casar com os itens do modelo (mesma
  // regra de app/ordens/[id]/page.tsx — ver resolverItensModelo).
  useEffect(() => {
    if (DEMO || !supabase) {
      setProdutos(PRODUTOS_DEMO);
      return;
    }
    supabase
      .from("vw_estoque")
      .select("*")
      .eq("ativo", true)
      .order("nome")
      .limit(300)
      .then(({ data }) => setProdutos((data as Produto[]) ?? []));
  }, []);

  /** Evita duplicar cliente/veículo quando a placa já tem cadastro —
   * mesma lógica da Entrada normal, só que sem buscar o histórico de
   * OS anteriores (não é o foco aqui). */
  const consultarPlaca = async (valorPlaca: string) => {
    const normalizada = normalizarPlaca(valorPlaca);
    if (normalizada.length < 7 || normalizada === placaConsultada) return;
    setPlacaConsultada(normalizada);
    setConsultandoPlaca(true);
    setConhecido(null);
    try {
      if (DEMO || !supabase) {
        const achado = buscarHistoricoDemoPorPlaca(normalizada);
        if (achado) {
          const achadoConhecido = { veiculoId: achado.veiculo.id, clienteId: achado.cliente.id ?? "", nome: achado.cliente.nome, telefone: achado.cliente.telefone };
          setConhecido(achadoConhecido);
          if (!nomeCliente) setNomeCliente(achadoConhecido.nome);
          if (!telefone && achadoConhecido.telefone) setTelefone(achadoConhecido.telefone);
        }
        return;
      }
      const semTraco = normalizada.replace("-", "");
      const variantes = semTraco === normalizada ? [normalizada] : [normalizada, semTraco];
      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id, cliente_id, clientes(id, nome, telefone)")
        .in("placa", variantes)
        .limit(1);
      const veiculo = veiculos?.[0];
      if (!veiculo) return;
      const cliente = Array.isArray(veiculo.clientes) ? veiculo.clientes[0] : veiculo.clientes;
      const achadoConhecido = { veiculoId: veiculo.id, clienteId: veiculo.cliente_id, nome: cliente?.nome ?? "", telefone: cliente?.telefone ?? null };
      setConhecido(achadoConhecido);
      if (!nomeCliente && achadoConhecido.nome) setNomeCliente(achadoConhecido.nome);
      if (!telefone && achadoConhecido.telefone) setTelefone(achadoConhecido.telefone);
    } catch {
      // Consulta é só conveniência — se falhar, segue com o formulário normal.
    } finally {
      setConsultandoPlaca(false);
    }
  };

  const modelo = todosModelos.find((m) => m.id === modeloId) ?? null;
  const itensResolvidos = modelo ? resolverItensModelo(modelo, produtos) : [];
  const totais = totalizarItensResolvidos(itensResolvidos);

  const abrirOsRapida = async () => {
    if (!modelo) {
      setErro("Escolha o serviço rápido.");
      return;
    }
    if (!placa.trim() || !nomeCliente.trim()) {
      setErro("Preencha a placa e o nome do cliente.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      if (DEMO || !supabase) {
        await new Promise((r) => setTimeout(r, 400));
        setAvisoDemo(true);
        setSalvando(false);
        return;
      }

      const reaproveitando = conhecido && normalizarPlaca(placa) === placaConsultada;
      let clienteId: string;
      let veiculoId: string;

      if (reaproveitando && conhecido) {
        clienteId = conhecido.clienteId;
        veiculoId = conhecido.veiculoId;
        if (nomeCliente !== conhecido.nome || telefone.replace(/\D/g, "") !== (conhecido.telefone ?? "")) {
          await supabase.from("clientes").update({ nome: nomeCliente, telefone: telefone.replace(/\D/g, "") }).eq("id", clienteId);
        }
      } else {
        const { data: cliente, error: eCliente } = await supabase
          .from("clientes")
          .insert({ nome: nomeCliente, telefone: telefone.replace(/\D/g, "") })
          .select("id")
          .single();
        if (eCliente) throw eCliente;
        clienteId = cliente.id;

        const { data: veiculo, error: eVeiculo } = await supabase
          .from("veiculos")
          .insert({ placa: normalizarPlaca(placa), cliente_id: clienteId })
          .select("id")
          .single();
        if (eVeiculo) throw eVeiculo;
        veiculoId = veiculo.id;
      }

      // A OS já nasce aprovada, com os itens do modelo — pedido do
      // Christian: "já sair a NF do cliente, sem ter que autorizar".
      const { data: os, error: eOs } = await supabase
        .from("ordens_servico")
        .insert({
          veiculo_id: veiculoId,
          cliente_id: clienteId,
          relato_cliente: `Serviço rápido: ${modelo.nome}`,
          status: "aprovado",
          valor_pecas: totais.valor_pecas,
          valor_servicos: totais.valor_servicos,
          valor_total: totais.valor_total,
        })
        .select("id")
        .single();
      if (eOs) throw eOs;

      const linhas = itensResolvidos.map((it) => ({
        os_id: os.id,
        tipo: it.tipo,
        descricao: it.descricao,
        quantidade: it.quantidade,
        valor_unit: it.valor_unit,
        produto_id: it.produto_id,
      }));
      const { error: eItens } = await supabase.from("os_itens").insert(linhas);
      if (eItens) {
        // Coluna produto_id pode não existir ainda — tenta de novo sem ela.
        const linhasSemProduto = linhas.map((l) => ({ os_id: l.os_id, tipo: l.tipo, descricao: l.descricao, quantidade: l.quantidade, valor_unit: l.valor_unit }));
        await supabase.from("os_itens").insert(linhasSemProduto);
      }

      const movimentos = itensResolvidos
        .filter((it) => it.tipo === "peca" && it.produto_id)
        .map((it) => ({ produto_id: it.produto_id, tipo: "saida_os" as const, quantidade: it.quantidade }));
      if (movimentos.length > 0) {
        await supabase.from("estoque_movimentos").insert(movimentos);
      }

      router.push(`/ordens/${os.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir a OS rápida.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[22px] uppercase leading-tight text-zinc-50 sm:text-3xl">⚡ Entrada Rápida</h1>
        <p className="mt-1 text-sm text-zinc-400">Pra quem passa rápido na oficina — escolhe o serviço e a OS já sai aprovada.</p>
      </div>

      {avisoDemo && (
        <PainelVidro className="border border-amber-400/40 p-4 text-sm text-amber-200">
          Em modo demonstração isto não grava de verdade — nenhum banco Supabase está configurado ainda. Configure as
          variáveis de ambiente para a OS ser criada de fato.
        </PainelVidro>
      )}

      <PainelVidro className="flex flex-col gap-4 p-5">
        <Campo
          label="Placa"
          value={placa}
          onChange={(v) => {
            setPlaca(v);
            if (normalizarPlaca(v) !== placaConsultada) {
              setConhecido(null);
              setPlacaConsultada("");
            }
          }}
          onBlur={() => consultarPlaca(placa)}
          placeholder="ABC-1D23"
        />
        {consultandoPlaca && <p className="text-xs text-zinc-500">Procurando essa placa no cadastro…</p>}
        {conhecido && (
          <p className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            Placa já cadastrada: {conhecido.nome || "cliente sem nome"}. Os dados abaixo foram preenchidos — ajuste se precisar.
          </p>
        )}

        <Campo label="Nome do cliente" value={nomeCliente} onChange={setNomeCliente} placeholder="Quem trouxe o veículo" />
        <Campo label="WhatsApp (opcional)" value={telefone} onChange={setTelefone} placeholder="41 98888-7777" />
      </PainelVidro>

      <PainelVidro className="flex flex-col gap-3 p-5">
        <h2 className="font-display text-[13px] uppercase text-zinc-200">Serviço</h2>
        <div className="flex flex-wrap gap-2">
          {todosModelos.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1">
              <button
                onClick={() => setModeloId(m.id)}
                className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                  modeloId === m.id
                    ? "border-amber-400/60 bg-amber-400/20 text-amber-200"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {m.nome}
              </button>
              {m.id.startsWith("custom-") && (
                <button
                  onClick={() => excluirServico(m.id)}
                  aria-label={`Excluir ${m.nome}`}
                  className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/20"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
          <button
            onClick={() => setCadastrandoServico((v) => !v)}
            className="rounded-full border border-dashed border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
          >
            {cadastrandoServico ? "✕ Cancelar" : "+ Novo serviço"}
          </button>
        </div>

        {cadastrandoServico && (
          <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/30 p-4">
            <Campo label="Nome do serviço" value={novoNome} onChange={setNovoNome} placeholder="Ex.: Revisão básica" />
            {novosItens.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 sm:grid-cols-[90px_1fr_60px_90px]">
                <select
                  value={it.tipo}
                  onChange={(e) => atualizarNovoItem(i, "tipo", e.target.value)}
                  className="campo-instrumento rounded-md border border-white/10 bg-black/30 px-2 py-2 text-xs text-zinc-100 outline-none"
                >
                  <option value="servico">Serviço</option>
                  <option value="peca">Peça</option>
                </select>
                <input
                  value={it.descricao}
                  onChange={(e) => atualizarNovoItem(i, "descricao", e.target.value)}
                  placeholder="Descrição"
                  className="campo-instrumento min-w-0 rounded-md border border-white/10 bg-black/30 px-2 py-2 text-xs text-zinc-100 outline-none"
                />
                <input
                  value={it.quantidade}
                  onChange={(e) => atualizarNovoItem(i, "quantidade", e.target.value)}
                  placeholder="Qtd."
                  inputMode="decimal"
                  className="campo-instrumento min-w-0 rounded-md border border-white/10 bg-black/30 px-2 py-2 text-xs text-zinc-100 outline-none"
                />
                <input
                  value={it.valorPadrao || ""}
                  onChange={(e) => atualizarNovoItem(i, "valorPadrao", e.target.value)}
                  placeholder="R$"
                  inputMode="decimal"
                  className="campo-instrumento min-w-0 rounded-md border border-white/10 bg-black/30 px-2 py-2 text-xs text-zinc-100 outline-none"
                />
              </div>
            ))}
            <button
              onClick={() => setNovosItens((a) => [...a, { tipo: "servico", descricao: "", quantidade: 1, valorPadrao: 0 }])}
              className="w-fit text-xs text-zinc-400 underline decoration-dotted underline-offset-4 hover:text-zinc-200"
            >
              + item
            </button>
            <TrailPlateButton tamanho="sm" onClick={salvarNovoServico} disabled={salvandoServico}>
              {salvandoServico ? "Salvando…" : "Salvar serviço"}
            </TrailPlateButton>
          </div>
        )}

        {modelo && (
          <div className="mt-1 divide-y divide-white/5 border-t border-white/5 pt-3">
            {itensResolvidos.map((it, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-zinc-300">
                  {it.descricao} <span className="text-zinc-600">· {it.quantidade}x</span>
                </span>
                <span className="font-mono text-zinc-400">{brl(it.quantidade * it.valor_unit)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 text-sm font-bold">
              <span className="text-zinc-200">Total</span>
              <span className="font-mono text-zinc-50">{brl(totais.valor_total)}</span>
            </div>
          </div>
        )}

        {erro && <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{erro}</p>}
      </PainelVidro>

      <TrailPlateButton onClick={abrirOsRapida} disabled={salvando || !modelo || !placa || !nomeCliente} className="w-full">
        {salvando ? "Abrindo OS…" : "Abrir OS aprovada"}
      </TrailPlateButton>
    </div>
  );
}
