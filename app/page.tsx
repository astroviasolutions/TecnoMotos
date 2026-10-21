import Link from "next/link";
import TrilhaDaMoto from "@/components/TrilhaDaMoto";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import Saudacao from "@/components/Saudacao";
import { IcoEntrada, IcoEstoque, IcoOrdens, IcoPainel, IcoRaio, IcoSeta } from "@/components/icones";

const PAINEIS = [
  { titulo: "Entrada de veículo", descricao: "Receber a moto, ler a placa e abrir a OS.", href: "/entrada", Ico: IcoEntrada, destaque: true },
  { titulo: "Ordens de serviço", descricao: "Diagnóstico, execução e entrega.", href: "/ordens", Ico: IcoOrdens },
  { titulo: "Estoque", descricao: "Peças, nota fiscal e cadastro rápido.", href: "/estoque", Ico: IcoEstoque },
  { titulo: "Painel", descricao: "Faturamento, OS abertas e giro de peças.", href: "/dashboard", Ico: IcoPainel },
];

export default function Home() {
  return (
    <RevealGroup className="flex flex-col gap-6">
      <RevealItem>
        <Saudacao />
      </RevealItem>

      <RevealItem>
        <Link href="/entrada" className="vidro-garagem atalho group relative flex items-center gap-4 overflow-hidden p-5">
          <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full" style={{ background: "radial-gradient(circle, rgb(var(--cor-acento-rgb) / .22), transparent 65%)" }} />
          <span className="atalho-ico h-14 w-14 rounded-2xl"><IcoEntrada size={26} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Ação rápida</span>
            <span className="font-display mt-0.5 block text-lg uppercase text-zinc-50">Nova entrada</span>
            <span className="block text-sm text-zinc-400">Fotografe a placa e abra a OS em segundos.</span>
          </span>
          <span className="trail-plate grid h-11 w-11 shrink-0 place-items-center !rounded-full"><IcoSeta size={18} /></span>
        </Link>
      </RevealItem>

      <RevealItem>
        <Link href="/entrada-rapida" className="vidro-garagem atalho group relative flex items-center gap-4 overflow-hidden p-5">
          <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,199,0,.22), transparent 65%)" }} />
          <span className="atalho-ico h-14 w-14 rounded-2xl !text-amber-300"><IcoRaio size={26} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">Passada rápida</span>
            <span className="font-display mt-0.5 block text-lg uppercase text-zinc-50">Entrada rápida</span>
            <span className="block text-sm text-zinc-400">Placa + cliente + serviço — OS já sai aprovada.</span>
          </span>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300"><IcoSeta size={18} /></span>
        </Link>
      </RevealItem>

      <RevealItem>
        <TrilhaDaMoto />
      </RevealItem>

      <section className="grid gap-3 sm:grid-cols-3">
        {PAINEIS.filter((p) => !p.destaque).map(({ titulo, descricao, href, Ico }) => (
          <RevealItem key={href}>
            <Link href={href} className="vidro-garagem atalho flex h-full items-center gap-4 p-4 sm:flex-col sm:items-start sm:p-5">
              <span className="atalho-ico shrink-0"><Ico size={21} /></span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-[15px] uppercase text-zinc-50">{titulo}</span>
                <span className="mt-0.5 block text-sm text-zinc-400">{descricao}</span>
              </span>
              <IcoSeta size={18} className="shrink-0 text-zinc-500 sm:hidden" />
            </Link>
          </RevealItem>
        ))}
      </section>
    </RevealGroup>
  );
}
