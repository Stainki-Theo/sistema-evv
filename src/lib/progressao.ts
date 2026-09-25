import {
  joinMissao,
  nextRepeticao,
  parseMissao,
  proximaBase,
  seqMap,
  RESULTADO,
  type MissionSeq,
} from "@/lib/missao";

/**
 * Próxima missão a partir do resultado registrado na Planilha do Anotador.
 *
 * - Aprovado: segue a sequência operacional configurada (nunca +1 automático);
 * - Não aprovado: mantém a missão-base e incrementa a repetição R1 → R2 → R3 → RN.
 */
export function computeProxima(
  missaoRealizada: string,
  resultado: string,
  seq?: Map<string, MissionSeq> | MissionSeq[] | null,
) {
  const map = seq instanceof Map ? seq : seqMap(seq ?? []);
  const { rep, base } = parseMissao(missaoRealizada);
  if (!base) return "";
  if (resultado === RESULTADO.NAO_APROVADO) {
    return joinMissao(nextRepeticao(rep), base);
  }
  if (resultado === RESULTADO.APROVADO) {
    const next = proximaBase(base, map);
    return next || base;
  }
  return "";
}
