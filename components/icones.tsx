/** Ícones de traço fino (24px, stroke 1.8) usados na navegação e nos atalhos. */
type P = { size?: number; className?: string };
const base = (size = 20) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const IcoInicio = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></svg>);
export const IcoEntrada = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M9 17h6l-3-7H8" /><path d="m15 10 2 7" /><path d="M14 6h3l1 4" /></svg>);
export const IcoOrdens = ({ size, className }: P) => (<svg {...base(size)} className={className}><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>);
export const IcoEstoque = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></svg>);
export const IcoPainel = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>);
export const IcoSeta = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IcoVoltar = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>);
export const IcoSol = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>);
export const IcoLua = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>);
export const IcoBusca = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IcoChave = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z" /></svg>);
export const IcoRaio = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>);

export const NAV = [
  { href: "/", rotulo: "Início", Ico: IcoInicio },
  { href: "/entrada", rotulo: "Entrada", Ico: IcoEntrada },
  { href: "/ordens", rotulo: "Ordens", Ico: IcoOrdens },
  { href: "/estoque", rotulo: "Estoque", Ico: IcoEstoque },
  { href: "/dashboard", rotulo: "Painel", Ico: IcoPainel },
];
export const rotaAtiva = (pathname: string | null, href: string) => (href === "/" ? pathname === "/" : !!pathname?.startsWith(href));
