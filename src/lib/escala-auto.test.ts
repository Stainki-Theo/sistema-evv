import { describe, expect, it } from "vitest";
import { buildAutoRows } from "./escala-auto";
import { computeProxima } from "./progressao";
import { seqMap, type MissionSeq, RESULTADO } from "./missao";
import { funcaoLabel, flightDuration, DEFAULT_FUNCTIONS } from "./evv";

const SEQ: MissionSeq[] = [
  ...Array.from({ length: 18 }, (_, i) => ({
    categoria: "PS",
    missao: `PS-${String(i + 1).padStart(2, "0")}`,
    proxima: `PS-${String(i + 2).padStart(2, "0")}`,
    pane: i + 1 >= 15,
  })),
  { categoria: "PS", missao: "PS-19", proxima: "X1", pane: false },
  { categoria: "X", missao: "X1", proxima: "", pane: false },
  { categoria: "RPS", missao: "RPS-02", proxima: "RPS-01", pane: true },
  { categoria: "RPS", missao: "RPS-01", proxima: "", pane: false },
  { categoria: "AP", missao: "AP", proxima: "", pane: false },
];
const seq = seqMap(SEQ);

const SAB = "2026-08-15";
const DOM = "2026-08-16";
const days = [SAB, DOM];

function person(id: string, proxima: string) {
  return { id, tri: id, war_name: id, proxima_missao: proxima, status: "ATIVO" };
}

describe("escala automática", () => {
  it("disponível sábado e domingo entra só no sábado", () => {
    const people = [person("STK", "PS-13")];
    const avail = () => [SAB, DOM];
    const sab = buildAutoRows({ day: SAB, days, people, availableDays: avail, seq });
    expect(sab.map((r) => r.missao)).toEqual(["PS-13"]);
    expect(buildAutoRows({ day: DOM, days, people, availableDays: avail, seq })).toHaveLength(0);
  });

  it("disponível só domingo entra no domingo", () => {
    const rows = buildAutoRows({
      day: DOM,
      days,
      people: [person("STK", "PS-13")],
      availableDays: () => [DOM],
      seq,
    });
    expect(rows.map((r) => r.missao)).toEqual(["PS-13"]);
  });

  it("com resultado registrado no sábado a escala de domingo é alimentada", () => {
    const rows = buildAutoRows({
      day: DOM,
      days,
      people: [person("STK", "PS-15")],
      availableDays: () => [SAB, DOM],
      progressedDays: () => [SAB],
      seq,
    });
    expect(rows[0]?.missao).toBe("PS-15");
    expect(rows[0]?.observacao).toBe("PANE");
  });

  it("PANE tem prioridade e recebe observação PANE", () => {
    const rows = buildAutoRows({
      day: SAB,
      days,
      people: [person("AAA", "PS-13"), person("BBB", "PS-15")],
      availableDays: () => [SAB],
      seq,
    });
    expect(rows[0]?.aluno).toContain("BBB");
    expect(rows[0]?.observacao).toBe("PANE");
    expect(rows.at(-1)?.missao).toBe("PS-13");
  });

  it("RPS-02 antecede RPS-01 e RPS-01 não é marcada como PANE", () => {
    const rows = buildAutoRows({
      day: SAB,
      days,
      people: [person("RMA", "RPS-02")],
      availableDays: () => [SAB],
      seq,
    });
    expect(rows.map((r) => [r.missao, r.observacao])).toEqual([
      ["RPS-02", "PANE"],
      ["RPS-01", ""],
    ]);
  });

  it("intercala três tripulantes em PANE por estágio", () => {
    const rows = buildAutoRows({
      day: SAB,
      days,
      people: [person("A", "PS-15"), person("B", "PS-15"), person("C", "PS-15")],
      availableDays: () => [SAB],
      seq,
    });
    expect(rows.slice(0, 6).map((r) => `${r.aluno.split(" ")[0]} ${r.missao}`)).toEqual([
      "A PS-15",
      "B PS-15",
      "C PS-15",
      "A PS-16",
      "B PS-16",
      "C PS-16",
    ]);
  });

  it("ordena PANE, PS decrescente e depois AP", () => {
    const rows = buildAutoRows({
      day: SAB,
      days,
      people: [
        person("A", "PS-04"),
        person("B", "AP"),
        person("C", "PS-19"),
        person("D", "PS-12"),
        person("E", "PS-15"),
      ],
      availableDays: () => [SAB],
      seq,
    });
    const seqOut = rows.map((r) => r.missao);
    expect(seqOut.slice(0, 4)).toEqual(["PS-15", "PS-16", "PS-17", "PS-18"]);
    expect(seqOut.slice(4)).toEqual(["PS-19", "PS-12", "PS-04", "AP"]);
  });

  it("repetição mantém a prioridade da missão-base", () => {
    const rows = buildAutoRows({
      day: SAB,
      days,
      people: [person("A", "PS-12"), person("B", "R1 PS-19")],
      availableDays: () => [SAB],
      seq,
    });
    expect(rows.map((r) => r.missao)).toEqual(["R1 PS-19", "PS-12"]);
  });

  it("integrante desativado não entra na escala", () => {
    const rows = buildAutoRows({
      day: SAB,
      days,
      people: [{ ...person("A", "PS-12"), status: "DESATIVADO" }],
      availableDays: () => [SAB],
      seq,
    });
    expect(rows).toHaveLength(0);
  });
});

describe("progressão", () => {
  it("aprovado segue a sequência configurada (PS-19 → X1)", () => {
    expect(computeProxima("PS-13", RESULTADO.APROVADO, seq)).toBe("PS-14");
    expect(computeProxima("PS-14", RESULTADO.APROVADO, seq)).toBe("PS-15");
    expect(computeProxima("PS-19", RESULTADO.APROVADO, seq)).toBe("X1");
  });

  it("não aprovado gera R1, R2, R3 e depois sempre RN", () => {
    let missao = "PS-13";
    const out: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      missao = computeProxima(missao, RESULTADO.NAO_APROVADO, seq);
      out.push(missao);
    }
    expect(out).toEqual(["R1 PS-13", "R2 PS-13", "R3 PS-13", "RN PS-13", "RN PS-13"]);
  });

  it("aprovado em repetição avança a missão-base", () => {
    expect(computeProxima("R2 PS-13", RESULTADO.APROVADO, seq)).toBe("PS-14");
  });
});

describe("utilitários", () => {
  it("mantém nomes de função íntegros", () => {
    expect(funcaoLabel("Sombra (Manhã)")).toBe("Sombra (Manhã)");
    expect(funcaoLabel("Chefe de Pista (Tarde)")).toBe("Chefe de Pista (Tarde)");
    expect(funcaoLabel("Ponta de Cabo 2")).toBe("Ponta de Cabo");
  });

  it("funções padrão trazem manhã e tarde em pares", () => {
    expect(DEFAULT_FUNCTIONS.slice(0, 6)).toEqual([
      "Chefe de Pista (Manhã)",
      "Chefe de Pista (Tarde)",
      "Sombra (Manhã)",
      "Sombra (Tarde)",
      "Rebocador (Manhã)",
      "Rebocador (Tarde)",
    ]);
  });

  it("calcula tempo de voo", () => {
    expect(flightDuration("12:30", "13:05").text).toBe("00:35");
    expect(flightDuration("12:30", "").text).toBe("—");
  });
});
