"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Vazio from "@/components/ui/Vazio";
import { lerValor } from "@/lib/dinheiro";
import { IcoOrdens } from "@/components/icones";
import { useRouter } from "next/navigation";
import PainelVidro from "@/components/ui/PainelVidro";
import BadgeStatus from "@/components/ui/BadgeStatus";
import Campo from "@/components/ui/Campo";
import TrailPlateButton from "@/components/TrailPlateButton";
import CameraCaptura from "@/components/CameraCaptura";
import AprovacaoOS from "@/components/AprovacaoOS";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { DEMO, supabase } from "@/lib/supabase";
import { ORDENS_DEMO, ITENS_DEMO, PRODUTOS_DEMO } from "@/lib/dados-demo";
import { MODELOS_SERVICO_RAPIDO, type ModeloServicoRapido } from "@/lib/modelosServico";
import {
  brl,
  COLUNAS_KANBAN,
  STATUS_COR,
  STATUS_LABEL,
  type ItemOS,
  type OrdemServico,
  type Produto,
  type StatusOS,
} from "@/lib/tipos";

const TODOS_STATUS: StatusOS[] = [...COLUNAS_KANBAN, "entregue"];

/** Status em que a OS ainda não tem a aprovação do cliente — é só a
 * partir desses que um modelo de serviço rápido pode empurrar a OS
 * direto pra "aprovado" (pular a autorização). Uma OS que já passou
 * dessa etapa (em execução, aguardando peça, finalizada, entregue)
 * não regride de status só por ganhar um item novo. */
const STATUS_PRE_APROVACAO: StatusOS[] = ["recepcao", "diagnostico", "aguardando_aprovacao"];

/** Soma os itens por tipo e devolve os três valores que a
 * ordens_servico guarda — é o que mantém o quadro de Ordens e o
 * Dashboard (que leem valor_total direto da tabela) sempre batendo
 * com o que está lançado aqui, sem precisar abrir a OS de novo. */
function somarItens(itens: ItemOS[], desconto: number) {
  const valor_pecas = itens.filter((i) => i.tipo === "peca").reduce((s, i) => s + i.quantidade * i.valor_unit, 0);
  const valor_servicos = itens.filter((i) => i.tipo === "servico").reduce((s, i) => s + i.quantidade * i.valor_unit, 0);
  const valor_total = Math.max(0, valor_pecas + valor_servicos - desconto);
  return { valor_pecas, valor_servicos, valor_total };
}

export default function PaginaOS({ params }: PageProps<"/ordens/[id]">) {
  const { id } = use(params);
  const router = useRouter();
  const [os, setOs] = useState<OrdemServico | null>(null);
  const [itens, setItens] = useState<ItemOS[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [erroCarregar, setErroCarregar] = useState("");
  const [statusSelecionado, setStatusSelecionado] = useState<StatusOS | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [erroCancelar, setErroCancelar] = useState("");

  // Diagnóstico (o que foi encontrado no problema) — antes só existia
  // como campo de exibição (preenchido, na prática, por ninguém: nenhuma
  // tela deixava escrever nele). Pedido do Christian: um campo aqui pra
  // registrar o problema encontrado, com foto se precisar, que vai
  // junto no PDF e na página pública de aprovação/assinatura.
  const [diagnosticoTexto, setDiagnosticoTexto] = useState("");
  const [fotosDiagnosticoSalvas, setFotosDiagnosticoSalvas] = useState<string[]>([]);
  const [fotosDiagnosticoNovas, setFotosDiagnosticoNovas] = useState<{ blob: Blob; url: string }[]>([]);
  const [abrindoCameraDiagnostico, setAbrindoCameraDiagnostico] = useState(false);
  const [salvandoDiagnostico, setSalvandoDiagnostico] = useState(false);
  const [diagnosticoSalvo, setDiagnosticoSalvo] = useState(false);
  const [erroDiagnostico, setErroDiagnostico] = useState("");

  // Só sincroniza com o que veio do banco quando a OS troca (pelo id) —
  // não a cada `carregar()` de novo (ex.: depois de lançar um item),
  // senão um rascunho de diagnóstico ainda não salvo seria perdido.
  useEffect(() => {
    if (os) {
      setDiagnosticoTexto(os.diagnostico ?? "");
      setFotosDiagnosticoSalvas(os.diagnostico_fotos ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [os?.id]);

  const removerFotoDiagnosticoNova = (indice: number) => {
    setFotosDiagnosticoNovas((atual) => {
      const copia = [...atual];
      const [removida] = copia.splice(indice, 1);
      if (removida) URL.revokeObjectURL(removida.url);
      return copia;
    });
  };

  const salvarDiagnostico = async () => {
    if (!os) return;
    setSalvandoDiagnostico(true);
    setErroDiagnostico("");
    try {
      if (DEMO || !supabase) {
        await new Promise((r) => setTimeout(r, 300));
        const fotosFinais = [...fotosDiagnosticoSalvas, ...fotosDiagnosticoNovas.map((f) => f.url)];
        setFotosDiagnosticoSalvas(fotosFinais);
        setFotosDiagnosticoNovas([]);
        setOs((atual) => (atual ? { ...atual, diagnostico: diagnosticoTexto || null, diagnostico_fotos: fotosFinais } : atual));
        setDiagnosticoSalvo(true);
        setTimeout(() => setDiagnosticoSalvo(false), 2000);
        return;
      }

      // Fotos novas: melhor esforço, mesmo padrão da foto da moto na
      // Entrada — se o bucket de storage ainda não existir (falta rodar
      // supabase/2026-09-18-diagnostico-fotos.sql), o texto do
      // diagnóstico ainda assim é salvo, só sem as fotos anexadas.
      const urlsNovas: string[] = [];
      for (let i = 0; i < fotosDiagnosticoNovas.length; i++) {
        const caminho = `${os.id}/${Date.now()}-${i}.jpg`;
        const { error: eUpload } = await supabase.storage
          .from("os-diagnostico-fotos")
          .upload(caminho, fotosDiagnosticoNovas[i].blob, { contentType: "image/jpeg" });
        if (!eUpload) {
          const { data: pub } = supabase.storage.from("os-diagnostico-fotos").getPublicUrl(caminho);
          if (pub?.publicUrl) urlsNovas.push(pub.publicUrl);
        }
      }
      const fotosFinais = [...fotosDiagnosticoSalvas, ...urlsNovas];

      const { error } = await supabase
        .from("ordens_servico")
        .update({ diagnostico: diagnosticoTexto || null, diagnostico_fotos: fotosFinais })
        .eq("id", os.id);
      if (error) {
        // Coluna diagnostico_fotos pode não existir ainda (migração
        // pendente) — tenta de novo só com o texto, pra não travar o
        // diagnóstico inteiro por causa disso.
        const { error: eSoTexto } = await supabase
          .from("ordens_servico")
          .update({ diagnostico: diagnosticoTexto || null })
          .eq("id", os.id);
        if (eSoTexto) throw eSoTexto;
      }

      setFotosDiagnosticoSalvas(fotosFinais);
      setFotosDiagnosticoNovas([]);
      setOs((atual) => (atual ? { ...atual, diagnostico: diagnosticoTexto || null, diagnostico_fotos: fotosFinais } : atual));
      setDiagnosticoSalvo(true);
      setTimeout(() => setDiagnosticoSalvo(false), 2000);
    } catch (e) {
      setErroDiagnostico(e instanceof Error ? e.message : "Não foi possível salvar o diagnóstico.");
    } finally {
      setSalvandoDiagnostico(false);
    }
  };

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [formAberto, setFormAberto] = useState(false);
  const [tipoNovo, setTipoNovo] = useState<"peca" | "servico">("servico");
  const [produtoNovo, setProdutoNovo] = useState("");
  const [descricaoNovo, setDescricaoNovo] = useState("");
  const [quantidadeNovo, setQuantidadeNovo] = useState("1");
  const [valorNovo, setValorNovo] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [erroItem, setErroItem] = useState("");

  // Edição direta de um item já lançado (nome/qtd./preço) — pedido do
  // Christian: "deixe editável o nome e preço... para não ter que ficar
  // apagando". Se o item tiver produto_id (veio do estoque), salvar
  // também corrige o produto no estoque inteiro, não só nesta OS.
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null);
  const [edDescricao, setEdDescricao] = useState("");
  const [edQuantidade, setEdQuantidade] = useState("1");
  const [edValorUnit, setEdValorUnit] = useState("");
  const [salvandoEdicaoItem, setSalvandoEdicaoItem] = useState(false);
  const [erroEdicaoItem, setErroEdicaoItem] = useState("");

  // Modelos de serviço rápido (ex.: "Troca de óleo") — lança o pacote
  // de itens inteiro de uma vez e já aprova a OS sem esperar o cliente
  // autorizar pelo link do WhatsApp.
  const [aplicandoModelo, setAplicandoModelo] = useState<string | null>(null);
  const [erroModelo, setErroModelo] = useState("");
  const [modeloAplicado, setModeloAplicado] = useState("");
  // Desconto da OS: aceita "R$ 20", "20,00" ou "10%"; pode ser ajustado
  // mesmo depois de finalizada (cliente pediu desconto na entrega etc.)
  const [descontoTxt, setDescontoTxt] = useState<string | null>(null);
  const [salvandoDesconto, setSalvandoDesconto] = useState(false);

  const carregar = useCallback(async () => {
    if (DEMO || !supabase) {
      const encontrada = ORDENS_DEMO.find((o) => o.id === id) ?? null;
      setOs(encontrada);
      setStatusSelecionado(encontrada?.status ?? null);
      setItens(ITENS_DEMO.filter((i) => i.os_id === id));
      setCarregando(false);
      return;
    }
    setErroCarregar("");
    const { data, error: erroOS } = await supabase
      .from("ordens_servico")
      .select("*, veiculos(placa, marca, modelo, ano, fotos_url), clientes(nome, telefone)")
      .eq("id", id)
      .single();
    if (erroOS) {
      // Distingue "OS não existe" de "erro de verdade" (ex.: coluna que
      // ainda não existe porque um script SQL pendente não rodou) — sem
      // isso, qualquer erro de banco aparecia como "não encontrada",
      // o que é enganoso e difícil de diagnosticar.
      setErroCarregar(erroOS.message);
      setOs(null);
      setCarregando(false);
      return;
    }
    const encontrada = (data as unknown as OrdemServico) ?? null;
    setOs(encontrada);
    setStatusSelecionado(encontrada?.status ?? null);
    const { data: i, error: erroItens } = await supabase.from("os_itens").select("*").eq("os_id", id).order("criado_em");
    if (erroItens) setErroCarregar(erroItens.message);
    setItens((i as unknown as ItemOS[]) ?? []);
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

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

  const salvarStatus = async () => {
    if (!statusSelecionado || !os) return;
    setSalvando(true);
    setErro("");

    // Grava quando a OS entrou em "finalizado"/"entregue" — sem isso, essas
    // datas nunca eram preenchidas fora dos dados de demonstração, e o
    // Dashboard (que soma faturamento e conta OS realizadas a partir delas)
    // ficava sempre zerado. Só grava na primeira vez (não sobrescreve se a
    // pessoa for e voltar de status).
    const agora = new Date().toISOString();
    const camposData: { finalizada_em?: string; entregue_em?: string } = {};
    if (statusSelecionado === "finalizado" && !os.finalizada_em) camposData.finalizada_em = agora;
    if (statusSelecionado === "entregue") {
      if (!os.finalizada_em) camposData.finalizada_em = agora;
      if (!os.entregue_em) camposData.entregue_em = agora;
    }

    if (DEMO || !supabase) {
      await new Promise((r) => setTimeout(r, 350));
      setOs((atual) => (atual ? { ...atual, status: statusSelecionado, ...camposData } : atual));
      setSalvando(false);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
      return;
    }
    const { error } = await supabase
      .from("ordens_servico")
      .update({ status: statusSelecionado, ...camposData })
      .eq("id", id);
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
    carregar();
  };

  /** "Excluir a OS" aqui é sempre marcar como cancelada (soft) — o
   * status "cancelado" já existe na paleta/pipeline desde o começo do
   * projeto, mas nenhuma tela dava um jeito de chegar nele. Apagar de
   * verdade quebraria o histórico (itens lançados, movimentos de
   * estoque já baixados) — cancelar preserva tudo e ainda dá pra
   * reverter depois escolhendo outro status normalmente. */
  const cancelarOS = async () => {
    setCancelando(true);
    setErroCancelar("");
    if (DEMO || !supabase) {
      await new Promise((r) => setTimeout(r, 350));
      router.push("/ordens");
      return;
    }
    const { error } = await supabase.from("ordens_servico").update({ status: "cancelado" }).eq("id", id);
    setCancelando(false);
    if (error) {
      setErroCancelar(error.message);
      return;
    }
    router.push("/ordens");
  };

  const limparFormItem = () => {
    setProdutoNovo("");
    setDescricaoNovo("");
    setQuantidadeNovo("1");
    setValorNovo("");
    setErroItem("");
  };

  const escolherProduto = (produtoId: string) => {
    setProdutoNovo(produtoId);
    const p = produtos.find((x) => x.id === produtoId);
    if (p) {
      setDescricaoNovo(p.nome);
      setValorNovo(String(p.preco_venda));
    }
  };

  const adicionarItem = async () => {
    const quantidade = Number(quantidadeNovo.replace(",", "."));
    const valor_unit = lerValor(valorNovo);
    if (!descricaoNovo.trim()) {
      setErroItem("Descreva a peça ou o serviço.");
      return;
    }
    if (!quantidade || quantidade <= 0) {
      setErroItem("Quantidade precisa ser maior que zero.");
      return;
    }
    setAdicionando(true);
    setErroItem("");

    const produtoId = tipoNovo === "peca" && produtoNovo ? produtoNovo : null;

    if (DEMO || !supabase) {
      await new Promise((r) => setTimeout(r, 300));
      const novo: ItemOS = {
        id: `demo-${Date.now()}`,
        os_id: id,
        tipo: tipoNovo,
        descricao: descricaoNovo.trim(),
        quantidade,
        valor_unit: valor_unit || 0,
        produto_id: produtoId,
      };
      const proximosItens = [...itens, novo];
      setItens(proximosItens);
      setOs((atual) => (atual ? { ...atual, ...somarItens(proximosItens, atual.valor_desconto) } : atual));
      setAdicionando(false);
      setFormAberto(false);
      limparFormItem();
      return;
    }

    const linhaItem = {
      os_id: id,
      tipo: tipoNovo,
      descricao: descricaoNovo.trim(),
      quantidade,
      valor_unit: valor_unit || 0,
    };
    let { error: eItem } = await supabase.from("os_itens").insert({ ...linhaItem, produto_id: produtoId });
    if (eItem && produtoId) {
      // Coluna produto_id pode não existir ainda (migração pendente) —
      // tenta de novo sem ela, pra não travar o lançamento do item.
      ({ error: eItem } = await supabase.from("os_itens").insert(linhaItem));
    }
    if (eItem) {
      setErroItem(eItem.message);
      setAdicionando(false);
      return;
    }

    // Peça vinculada ao estoque: abate o saldo com um movimento
    // "saida_os" — não há coluna produto_id em os_itens, então esse
    // vínculo é só nesse instante (excluir o item depois não devolve
    // o estoque automaticamente).
    if (tipoNovo === "peca" && produtoNovo) {
      await supabase.from("estoque_movimentos").insert({
        produto_id: produtoNovo,
        tipo: "saida_os",
        quantidade,
      });
    }

    const proximosItens = [...itens, { id: "temp", os_id: id, tipo: tipoNovo, descricao: descricaoNovo.trim(), quantidade, valor_unit: valor_unit || 0 }];
    if (os) {
      await supabase.from("ordens_servico").update(somarItens(proximosItens, os.valor_desconto)).eq("id", id);
    }

    setAdicionando(false);
    setFormAberto(false);
    limparFormItem();
    carregar();
  };

  const aplicarDesconto = async (subtotal: number) => {
    if (!os || descontoTxt === null) return;
    const valor_desconto = Math.min(subtotal, Math.round(lerValor(descontoTxt, subtotal) * 100) / 100);
    const novos = { valor_desconto, ...somarItens(itens, valor_desconto) };
    setSalvandoDesconto(true);
    if (!DEMO && supabase) {
      const { error } = await supabase.from("ordens_servico").update(novos).eq("id", id);
      if (error) {
        setSalvandoDesconto(false);
        setErroItem(`Não foi possível salvar o desconto: ${error.message}`);
        return;
      }
    }
    setOs((atual) => (atual ? { ...atual, ...novos } : atual));
    setDescontoTxt(null);
    setSalvandoDesconto(false);
  };

  const removerItem = async (itemId: string) => {
    const restantes = itens.filter((i) => i.id !== itemId);
    if (DEMO || !supabase) {
      setItens(restantes);
      setOs((atual) => (atual ? { ...atual, ...somarItens(restantes, atual.valor_desconto) } : atual));
      return;
    }
    await supabase.from("os_itens").delete().eq("id", itemId);
    if (os) {
      await supabase.from("ordens_servico").update(somarItens(restantes, os.valor_desconto)).eq("id", id);
    }
    carregar();
  };

  const iniciarEdicaoItem = (item: ItemOS) => {
    setEditandoItemId(item.id);
    setEdDescricao(item.descricao);
    setEdQuantidade(String(item.quantidade));
    setEdValorUnit(String(item.valor_unit));
    setErroEdicaoItem("");
  };

  const cancelarEdicaoItem = () => {
    setEditandoItemId(null);
    setErroEdicaoItem("");
  };

  /** Salva nome/qtd./preço editados direto no item da OS — sem precisar
   * apagar e relançar. Quando o item tem produto_id (veio do estoque),
   * a mesma correção também é aplicada no produto, pra não ficar só
   * nesta OS (pedido do Christian: "altere no estoque todo"). */
  const salvarEdicaoItem = async (item: ItemOS) => {
    const quantidade = Number(edQuantidade.replace(",", "."));
    const valor_unit = lerValor(edValorUnit);
    if (!edDescricao.trim()) {
      setErroEdicaoItem("Descreva a peça ou o serviço.");
      return;
    }
    if (!quantidade || quantidade <= 0) {
      setErroEdicaoItem("Quantidade precisa ser maior que zero.");
      return;
    }
    setSalvandoEdicaoItem(true);
    setErroEdicaoItem("");

    const descricao = edDescricao.trim();
    const restantes = itens.map((i) => (i.id === item.id ? { ...i, descricao, quantidade, valor_unit } : i));

    if (DEMO || !supabase) {
      await new Promise((r) => setTimeout(r, 300));
      setItens(restantes);
      setOs((atual) => (atual ? { ...atual, ...somarItens(restantes, atual.valor_desconto) } : atual));
      if (item.produto_id) {
        setProdutos((atual) => atual.map((p) => (p.id === item.produto_id ? { ...p, nome: descricao, preco_venda: valor_unit } : p)));
      }
      setSalvandoEdicaoItem(false);
      setEditandoItemId(null);
      return;
    }

    const { error: eItem } = await supabase
      .from("os_itens")
      .update({ descricao, quantidade, valor_unit })
      .eq("id", item.id);
    if (eItem) {
      setErroEdicaoItem(eItem.message);
      setSalvandoEdicaoItem(false);
      return;
    }

    if (os) {
      await supabase.from("ordens_servico").update(somarItens(restantes, os.valor_desconto)).eq("id", id);
    }

    if (item.produto_id) {
      // Melhor esforço: se isso falhar (ex.: peça excluída do estoque
      // nesse meio tempo), o item da OS já foi salvo normalmente —
      // só não propaga pro cadastro da peça.
      const { error: eProduto } = await supabase
        .from("produtos")
        .update({ nome: descricao, preco_venda: valor_unit })
        .eq("id", item.produto_id);
      if (!eProduto) {
        setProdutos((atual) => atual.map((p) => (p.id === item.produto_id ? { ...p, nome: descricao, preco_venda: valor_unit } : p)));
      }
    }

    setSalvandoEdicaoItem(false);
    setEditandoItemId(null);
    carregar();
  };

  /** Lança de uma vez o pacote de itens de um modelo de serviço rápido
   * (ex.: "Troca de óleo") e, se a OS ainda não tiver sido
   * aprovada/autorizada pelo cliente, já avança ela pra "aprovado" —
   * pedido do Christian: "já sair a NF do cliente, sem ter que
   * autorizar". Depois de aplicado, "Baixar PDF" (painel abaixo) já
   * gera a nota com os itens lançados. */
  const aplicarModeloRapido = async (modelo: ModeloServicoRapido) => {
    if (!os) return;
    setAplicandoModelo(modelo.id);
    setErroModelo("");
    setModeloAplicado("");

    // Peça do modelo com produto correspondente no estoque (por nome)
    // usa o preço real do estoque e fica vinculada a ele; sem
    // correspondência, usa o valor padrão do modelo e segue sem vínculo.
    const itensResolvidos = modelo.itens.map((it) => {
      if (it.tipo !== "peca") return { ...it, produto_id: null as string | null, valor_unit: it.valorPadrao };
      const produto = produtos.find((p) => p.nome.trim().toLowerCase() === it.descricao.trim().toLowerCase());
      return {
        tipo: it.tipo,
        descricao: produto?.nome ?? it.descricao,
        quantidade: it.quantidade,
        valor_unit: produto?.preco_venda ?? it.valorPadrao,
        produto_id: produto?.id ?? null,
      };
    });

    const avancaStatus = STATUS_PRE_APROVACAO.includes(os.status);
    const novoStatus: StatusOS = avancaStatus ? "aprovado" : os.status;

    if (DEMO || !supabase) {
      await new Promise((r) => setTimeout(r, 400));
      const novosItens: ItemOS[] = itensResolvidos.map((it, i) => ({
        id: `demo-modelo-${Date.now()}-${i}`,
        os_id: id,
        tipo: it.tipo,
        descricao: it.descricao,
        quantidade: it.quantidade,
        valor_unit: it.valor_unit,
        produto_id: it.produto_id,
      }));
      const proximosItens = [...itens, ...novosItens];
      setItens(proximosItens);
      setOs((atual) => (atual ? { ...atual, ...somarItens(proximosItens, atual.valor_desconto), status: novoStatus } : atual));
      setStatusSelecionado(novoStatus);
      setAplicandoModelo(null);
      setModeloAplicado(`${modelo.nome} lançado${avancaStatus ? " e OS já aprovada" : ""} — baixe o PDF abaixo.`);
      return;
    }

    const linhas = itensResolvidos.map((it) => ({
      os_id: id,
      tipo: it.tipo,
      descricao: it.descricao,
      quantidade: it.quantidade,
      valor_unit: it.valor_unit,
      produto_id: it.produto_id,
    }));
    let { error: eItens } = await supabase.from("os_itens").insert(linhas);
    if (eItens) {
      // Coluna produto_id pode não existir ainda — tenta de novo sem ela.
      const linhasSemProduto = linhas.map((l) => ({
        os_id: l.os_id,
        tipo: l.tipo,
        descricao: l.descricao,
        quantidade: l.quantidade,
        valor_unit: l.valor_unit,
      }));
      ({ error: eItens } = await supabase.from("os_itens").insert(linhasSemProduto));
    }
    if (eItens) {
      setErroModelo(eItens.message);
      setAplicandoModelo(null);
      return;
    }

    const movimentos = itensResolvidos.filter((it) => it.tipo === "peca" && it.produto_id).map((it) => ({
      produto_id: it.produto_id,
      tipo: "saida_os" as const,
      quantidade: it.quantidade,
    }));
    if (movimentos.length > 0) {
      await supabase.from("estoque_movimentos").insert(movimentos);
    }

    const itensComTemp: ItemOS[] = [
      ...itens,
      ...itensResolvidos.map((it) => ({ id: "temp", os_id: id, tipo: it.tipo, descricao: it.descricao, quantidade: it.quantidade, valor_unit: it.valor_unit })),
    ];
    await supabase
      .from("ordens_servico")
      .update({ ...somarItens(itensComTemp, os.valor_desconto), status: novoStatus })
      .eq("id", id);

    setStatusSelecionado(novoStatus);
    setAplicandoModelo(null);
    setModeloAplicado(`${modelo.nome} lançado${avancaStatus ? " e OS já aprovada" : ""} — baixe o PDF abaixo.`);
    carregar();
  };

  if (carregando) {
    return (
      <div className="pt-4">
        <div className="h-8 w-40 animate-pulse rounded bg-white/5" />
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-white/5" />
      </div>
    );
  }

  if (abrindoCameraDiagnostico) {
    return (
      <CameraCaptura
        titulo="Fotografe o problema"
        multiplo
        contagemAtual={fotosDiagnosticoNovas.length}
        onFoto={(blob) => setFotosDiagnosticoNovas((atual) => [...atual, { blob, url: URL.createObjectURL(blob) }])}
        onCancelar={() => setAbrindoCameraDiagnostico(false)}
        onConcluir={() => setAbrindoCameraDiagnostico(false)}
      />
    );
  }

  if (!os) {
    return (
      <PainelVidro className="mt-4 p-8 text-center">
        {erroCarregar ? (
          <>
            <p className="text-sm font-bold uppercase tracking-wide text-red-400">Erro ao carregar a OS</p>
            <p className="mx-auto mt-2 max-w-md rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {erroCarregar}
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              Se a mensagem mencionar uma coluna que não existe (ex.: <code>fotos_url</code>), falta rodar o script{" "}
              <code>supabase/2026-09-17-fotos-da-moto.sql</code> no SQL Editor do Supabase.
            </p>
          </>
        ) : (
          <Vazio icone={<IcoOrdens size={30} />} titulo="OS não encontrada" texto="Ela pode ter sido apagada ou o link está errado." />
        )}
        <Link href="/ordens" className="mt-3 inline-block text-sm text-zinc-200 underline">
          Voltar para o quadro
        </Link>
      </PainelVidro>
    );
  }

  const subtotal = itens.reduce((soma, i) => soma + i.quantidade * i.valor_unit, 0);
  const desconto = Math.min(subtotal, Number(os.valor_desconto || 0));
  const total = itens.length ? Math.max(0, subtotal - desconto) : os.valor_total;
  const previaDesconto = descontoTxt !== null ? Math.min(subtotal, lerValor(descontoTxt, subtotal)) : 0;
  const statusMudou = statusSelecionado !== null && statusSelecionado !== os.status;

  return (
    <RevealGroup className="flex flex-col gap-6">
      <Link href="/ordens" className="w-fit text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-300">
        ← Voltar para Ordens
      </Link>

      <RevealItem className="flex items-center justify-between">
        <h1 className="font-mono text-2xl font-bold text-zinc-50">OS {String(os.numero).padStart(4, "0")}</h1>
        <BadgeStatus status={os.status} tamanho="md" />
      </RevealItem>

      <RevealItem>
        <PainelVidro corStatus={STATUS_COR[os.status]} className="p-5">
          <p className="text-sm font-medium text-zinc-100">{os.clientes?.nome ?? "Sem cliente"}</p>
          <p className="text-xs text-zinc-500">
            {[os.veiculos?.marca, os.veiculos?.modelo, os.veiculos?.ano].filter(Boolean).join(" ")} · {os.veiculos?.placa}
          </p>
          {os.km_entrada && <p className="mt-1 text-xs text-zinc-500">{os.km_entrada.toLocaleString("pt-BR")} km na entrada</p>}
          {os.relato_cliente && (
            <p className="mt-3 text-sm text-zinc-300">
              <span className="text-zinc-500">Reclamação: </span>
              {os.relato_cliente}
            </p>
          )}
          {os.veiculos?.fotos_url && os.veiculos.fotos_url.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
              {os.veiculos.fotos_url.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-16 w-16 overflow-hidden rounded-lg border border-white/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Foto ${i + 1} da moto`} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </PainelVidro>
      </RevealItem>

      <RevealItem>
        <PainelVidro className="p-5">
          <h2 className="font-display text-[13px] uppercase text-zinc-200">Diagnóstico</h2>
          <p className="mt-1 text-xs text-zinc-500">O que foi encontrado — vai junto no PDF e na página que o cliente assina.</p>

          <textarea
            value={diagnosticoTexto}
            onChange={(e) => setDiagnosticoTexto(e.target.value)}
            rows={3}
            placeholder="Ex.: Pastilha dianteira no limite, disco com sulco leve."
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-zinc-100 outline-none focus:border-zinc-400"
          />

          {(fotosDiagnosticoSalvas.length > 0 || fotosDiagnosticoNovas.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {fotosDiagnosticoSalvas.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-16 w-16 overflow-hidden rounded-lg border border-white/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Foto do problema" className="h-full w-full object-cover" />
                </a>
              ))}
              {fotosDiagnosticoNovas.map((f, i) => (
                <div key={f.url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`Foto nova ${i + 1} do problema`} className="h-full w-full object-cover" />
                  <button
                    onClick={() => removerFotoDiagnosticoNova(i)}
                    aria-label="Remover foto"
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-zinc-200"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setAbrindoCameraDiagnostico(true)}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Fotografar o problema
          </button>

          {erroDiagnostico && <p className="mt-2 text-sm text-red-400">{erroDiagnostico}</p>}

          <div className="mt-4 flex items-center gap-3">
            <TrailPlateButton
              tamanho="sm"
              onClick={salvarDiagnostico}
              disabled={
                salvandoDiagnostico ||
                (diagnosticoTexto === (os.diagnostico ?? "") && fotosDiagnosticoNovas.length === 0)
              }
            >
              {salvandoDiagnostico ? "Salvando…" : "Salvar diagnóstico"}
            </TrailPlateButton>
            {diagnosticoSalvo && <span className="text-sm text-emerald-400">Diagnóstico salvo.</span>}
          </div>
        </PainelVidro>
      </RevealItem>

      <RevealItem>
        <PainelVidro className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[13px] uppercase text-zinc-200">Itens e serviços</h2>
            {!formAberto && (
              <TrailPlateButton tamanho="sm" onClick={() => setFormAberto(true)}>
                + Adicionar
              </TrailPlateButton>
            )}
          </div>

          {os.status !== "cancelado" && os.status !== "entregue" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-white/5 pb-3">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">⚡ Serviço rápido:</span>
              {MODELOS_SERVICO_RAPIDO.map((modelo) => (
                <button
                  key={modelo.id}
                  onClick={() => aplicarModeloRapido(modelo)}
                  disabled={aplicandoModelo !== null}
                  className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-400/20 disabled:opacity-50"
                >
                  {aplicandoModelo === modelo.id ? "Lançando…" : modelo.nome}
                </button>
              ))}
            </div>
          )}
          {erroModelo && <p className="mt-2 text-sm text-red-400">{erroModelo}</p>}
          {modeloAplicado && <p className="mt-2 text-sm text-emerald-400">{modeloAplicado}</p>}

          <div className="mt-3 divide-y divide-white/5">
            {itens.length === 0 && <Vazio titulo="Sem itens ainda" texto="Lance os serviços e peças para montar o orçamento." />}
            {itens.map((i) =>
              editandoItemId === i.id ? (
                <div key={i.id} className="flex flex-col gap-2 py-2.5">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="col-span-2">
                      <Campo label="Descrição" value={edDescricao} onChange={setEdDescricao} />
                    </div>
                    <Campo label="Qtd." value={edQuantidade} onChange={setEdQuantidade} inputMode="decimal" />
                    <Campo label="Valor unit. (R$)" value={edValorUnit} onChange={setEdValorUnit} inputMode="decimal" />
                  </div>
                  {i.produto_id && (
                    <p className="text-[11px] text-amber-300/80">Isso também atualiza esse produto no estoque.</p>
                  )}
                  {erroEdicaoItem && <p className="text-xs text-red-400">{erroEdicaoItem}</p>}
                  <div className="flex gap-2">
                    <TrailPlateButton tamanho="sm" onClick={() => salvarEdicaoItem(i)} disabled={salvandoEdicaoItem}>
                      {salvandoEdicaoItem ? "Salvando…" : "Salvar"}
                    </TrailPlateButton>
                    <button
                      onClick={cancelarEdicaoItem}
                      className="rounded-md border border-white/10 px-3 text-xs font-bold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-zinc-300">{i.descricao}</span>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                      {i.tipo === "peca" ? "Peça" : "Serviço"} · {i.quantidade}x {brl(i.valor_unit)}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-zinc-400">{brl(i.quantidade * i.valor_unit)}</span>
                  <button
                    onClick={() => iniciarEdicaoItem(i)}
                    aria-label="Editar item"
                    className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-zinc-300 transition-colors hover:bg-white/10"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => removerItem(i.id)}
                    aria-label="Remover item"
                    className="shrink-0 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    ✕
                  </button>
                </div>
              ),
            )}
          </div>

          {formAberto && (
            <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-4">
              <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                {(["servico", "peca"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTipoNovo(t);
                      setProdutoNovo("");
                    }}
                    className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                      tipoNovo === t ? "bg-zinc-200 text-zinc-900" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t === "peca" ? "Peça" : "Serviço"}
                  </button>
                ))}
              </div>

              {tipoNovo === "peca" && (
                <label className="mt-3 block">
                  <span className="mb-2 block text-[11px] uppercase tracking-wide text-zinc-500">Produto do estoque</span>
                  <select
                    value={produtoNovo}
                    onChange={(e) => escolherProduto(e.target.value)}
                    className="campo-instrumento w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-100 outline-none"
                  >
                    <option value="">Descrição manual…</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} {p.saldo != null ? `(${p.saldo} un.)` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="col-span-2">
                  <Campo label="Descrição" value={descricaoNovo} onChange={setDescricaoNovo} placeholder="Ex.: Troca de óleo" />
                </div>
                <Campo label="Qtd." value={quantidadeNovo} onChange={setQuantidadeNovo} inputMode="decimal" />
                <Campo label="Valor unit. (R$)" value={valorNovo} onChange={setValorNovo} inputMode="decimal" placeholder="0,00" />
              </div>

              {erroItem && (
                <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {erroItem}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <TrailPlateButton onClick={adicionarItem} disabled={adicionando} className="flex-1">
                  {adicionando ? "Lançando…" : "Lançar item"}
                </TrailPlateButton>
                <button
                  onClick={() => {
                    setFormAberto(false);
                    limparFormItem();
                  }}
                  className="rounded-md border border-white/10 px-4 text-xs font-bold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between text-sm text-zinc-400">
              <span>Subtotal</span>
              <span className="font-mono">{brl(subtotal)}</span>
            </div>
            {descontoTxt === null ? (
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => setDescontoTxt(desconto ? String(desconto).replace(".", ",") : "")} className="text-zinc-400 underline decoration-dotted underline-offset-4 hover:text-zinc-100">
                  {desconto ? "Desconto · ajustar" : "+ Dar desconto"}
                </button>
                {desconto > 0 && <span className="font-mono text-emerald-400">− {brl(desconto)}</span>}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={descontoTxt}
                    onChange={(e) => setDescontoTxt(e.target.value)}
                    placeholder="R$ 20 ou 10%"
                    aria-label="Desconto em reais ou porcentagem"
                    className="campo-instrumento min-w-0 flex-1 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                  />
                  <TrailPlateButton tamanho="sm" type="button" disabled={salvandoDesconto} onClick={() => aplicarDesconto(subtotal)}>
                    {salvandoDesconto ? "…" : "Aplicar"}
                  </TrailPlateButton>
                  <button type="button" aria-label="Cancelar desconto" onClick={() => setDescontoTxt(null)} className="btn-sec px-3 text-xs font-bold uppercase">✕</button>
                </div>
                <p className="text-xs text-zinc-500">
                  {previaDesconto > 0
                    ? `Desconto de ${brl(previaDesconto)}${descontoTxt.includes("%") ? ` (${descontoTxt.replace(/[^\d,.]/g, "")}%)` : ""} → total ${brl(Math.max(0, subtotal - previaDesconto))}`
                    : "Digite um valor (R$ 20) ou uma porcentagem (10%). Vazio tira o desconto."}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="font-display text-[13px] uppercase text-zinc-200">Total</span>
              <span className="font-mono text-xl font-bold text-zinc-50">{brl(total)}</span>
            </div>
          </div>

          <AprovacaoOS
            os={os}
            itens={itens}
            total={total}
            onStatusAtualizado={(novoStatus) => {
              setOs((atual) => (atual ? { ...atual, status: novoStatus } : atual));
              setStatusSelecionado(novoStatus);
            }}
          />
        </PainelVidro>
      </RevealItem>

      <RevealItem>
        <PainelVidro className="p-5">
          <h2 className="font-display text-[13px] uppercase text-zinc-200">Situação</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TODOS_STATUS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusSelecionado(s)}
                className={`rounded-lg border px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  statusSelecionado === s
                    ? "border-zinc-200 bg-zinc-200 text-zinc-900"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          {statusMudou && (
            <div className="mt-4">
              <TrailPlateButton onClick={salvarStatus} disabled={salvando} className="w-full">
                {salvando ? "Salvando…" : `Salvar → ${STATUS_LABEL[statusSelecionado as StatusOS]}`}
              </TrailPlateButton>
            </div>
          )}
          {salvo && <p className="mt-3 text-sm text-emerald-400">Situação salva.</p>}
          {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
        </PainelVidro>
      </RevealItem>

      {os.status !== "cancelado" && os.status !== "entregue" && (
        <RevealItem>
          <PainelVidro className="flex flex-col gap-3 p-5" style={{ borderColor: "rgba(248,113,113,.25)" }}>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Zona de exclusão</p>
            {!confirmandoCancelamento ? (
              <TrailPlateButton
                tamanho="sm"
                variante="perigo"
                onClick={() => setConfirmandoCancelamento(true)}
                className="w-fit"
              >
                Cancelar OS
              </TrailPlateButton>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-zinc-300">
                  A OS some do quadro ativo e vira "Cancelada", mas os itens lançados e o histórico ficam preservados.
                  Confirma?
                </p>
                {erroCancelar && (
                  <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                    {erroCancelar}
                  </p>
                )}
                <div className="flex gap-2">
                  <TrailPlateButton variante="perigo" onClick={cancelarOS} disabled={cancelando}>
                    {cancelando ? "Cancelando…" : "Sim, cancelar OS"}
                  </TrailPlateButton>
                  <button
                    onClick={() => setConfirmandoCancelamento(false)}
                    className="rounded-md border border-white/10 px-4 text-xs font-bold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </PainelVidro>
        </RevealItem>
      )}
    </RevealGroup>
  );
}

