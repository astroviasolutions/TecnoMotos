/**
 * O WhatsApp (Brasil) reconhece um UUID com hífens no meio da mensagem
 * como chave Pix aleatória e troca o link por "Copiar chave Pix" — o
 * cliente não consegue abrir. No link público a gente manda o id sem
 * hífens (32 hex), que o WhatsApp não confunde, e aqui volta ao formato
 * UUID que o banco espera.
 */
export function idParaLink(id: string): string {
  return id.replace(/-/g, "");
}

export function idDoLink(id: string): string {
  const limpo = id.trim();
  if (/^[0-9a-f]{32}$/i.test(limpo)) {
    return `${limpo.slice(0, 8)}-${limpo.slice(8, 12)}-${limpo.slice(12, 16)}-${limpo.slice(16, 20)}-${limpo.slice(20)}`;
  }
  return limpo;
}
