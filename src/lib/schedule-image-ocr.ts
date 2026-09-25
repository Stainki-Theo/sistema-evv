import { createWorker, PSM, type Word } from "tesseract.js";

export type ScheduleImageRow = {
  time_planned: string;
  aluno: string;
  instrutor: string;
  missao: string;
  observacao: string;
};

type PositionedWord = Pick<Word, "text" | "confidence" | "bbox">;

function clean(value: string) {
  return value.replace(/[|]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeTime(value: string) {
  const match = value.replace(/[Oo]/g, "0").match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function centerX(word: PositionedWord) {
  return (word.bbox.x0 + word.bbox.x1) / 2;
}

function centerY(word: PositionedWord) {
  return (word.bbox.y0 + word.bbox.y1) / 2;
}

function header(words: PositionedWord[], pattern: RegExp) {
  return words.find((word) => pattern.test(clean(word.text)));
}

/**
 * Converte as palavras posicionadas do OCR na grade usada pela escala do EVV.
 * A leitura se ancora nos cabeçalhos IN / AL / Missão / Observações e na coluna
 * de horários, portanto aceita fotos recortadas ou tiradas em resoluções diferentes.
 */
export function rowsFromScheduleWords(words: PositionedWord[]): ScheduleImageRow[] {
  const useful = words.filter((word) => clean(word.text) && word.confidence >= 25);
  const alHeader = header(useful, /^AL$/i);
  const missionHeader = header(useful, /^MISS[AÃ]O$/i);
  const notesHeader = header(useful, /^OBSERVA/i);

  if (!alHeader || !missionHeader) return [];
  const headerY = Math.max(centerY(alHeader), centerY(missionHeader));
  const inHeader = useful.find((word) => /^IN$/i.test(clean(word.text)) && centerX(word) < centerX(alHeader) && Math.abs(centerY(word) - headerY) < 30);
  const xIn = inHeader ? centerX(inHeader) : centerX(alHeader) - (centerX(missionHeader) - centerX(alHeader));
  const xAl = centerX(alHeader);
  const xMission = centerX(missionHeader);
  const xNotes = notesHeader ? centerX(notesHeader) : xMission + (xMission - xAl);

  const step = Math.max(20, xMission - xAl);
  const xTimeMin = xNotes + step * 1.25;
  const timeWords = useful
    .map((word) => ({ word, time: normalizeTime(clean(word.text)) }))
    .filter(({ word, time }) => time && centerY(word) > headerY + 8 && centerX(word) > xTimeMin)
    .sort((a, b) => centerY(a.word) - centerY(b.word));

  // Remove horários auxiliares (total de operação, reabastecimento etc.) e duplicatas.
  const uniqueTimes = timeWords.filter((item, index, list) => {
    if (item.time < "08:00" || item.time > "23:59") return false;
    return !list.slice(0, index).some((previous) => Math.abs(centerY(previous.word) - centerY(item.word)) < 6);
  });

  return uniqueTimes.flatMap(({ word: timeWord, time }) => {
    const y = centerY(timeWord);
    const height = Math.max(10, timeWord.bbox.y1 - timeWord.bbox.y0);
    const sameRow = useful
      .filter((word) => Math.abs(centerY(word) - y) <= Math.max(8, height * 0.7) && centerX(word) < xTimeMin)
      .sort((a, b) => a.bbox.x0 - b.bbox.x0);

    const cell = (from: number, to: number) => clean(sameRow.filter((w) => centerX(w) >= from && centerX(w) < to).map((w) => w.text).join(" "));
    const bInAl = (xIn + xAl) / 2;
    const bAlMission = (xAl + xMission) / 2;
    const bMissionNotes = (xMission + xNotes) / 2;
    const bNotesEnd = xNotes + step * 0.7;
    const instrutor = cell(xIn - step * 0.55, bInAl);
    const aluno = cell(bInAl, bAlMission);
    const missao = cell(bAlMission, bMissionNotes).replace(/\s+/g, "");
    const observacao = cell(bMissionNotes, bNotesEnd);

    // Linhas de evento (“REABASTECE”, “FIM DA OP”) não são voos.
    if (!aluno || !missao || /REABAST|FIM\s*DA\s*OP/i.test(`${aluno} ${missao} ${observacao}`)) return [];
    return [{ time_planned: time, aluno, instrutor, missao, observacao }];
  });
}

export async function readScheduleImage(file: File, onProgress?: (progress: number) => void) {
  const sources = await fileToOcrSources(file);
  const worker = await createWorker(["por", "eng"], undefined, {
    logger: () => undefined,
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });
    const rows: ScheduleImageRow[] = [];
    for (let index = 0; index < sources.length; index += 1) {
      const result = await worker.recognize(
        sources[index],
        { rotateAuto: true },
        { blocks: true, text: true },
      );
      const words = (result.data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words)),
      );
      rows.push(...rowsFromScheduleWords(words));
      onProgress?.((index + 1) / sources.length);
    }
    return rows;
  } finally {
    await worker.terminate();
  }
}

async function fileToOcrSources(file: File): Promise<Array<File | HTMLCanvasElement>> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return [file];

  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const document = await getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: HTMLCanvasElement[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.4 });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Não foi possível preparar a página do PDF.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pages.push(canvas);
  }

  return pages;
}
