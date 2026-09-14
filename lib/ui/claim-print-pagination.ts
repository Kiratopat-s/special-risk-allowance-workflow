export interface ClaimPrintPage {
  rowIndices: number[];
  blankRows: number;
  noteText: string;
  blankNoteLines: number;
}

export interface ClaimPrintMeasurements {
  capacity: number;
  rowHeights: number[];
  blankRowHeight: number;
  noteOverhead: number;
  lineHeight: number;
  measureNote: (text: string) => number;
}

/** Splits only notes, on grapheme boundaries, using the browser's loaded Thai font. */
function takeNote(text: string, height: number, measure: (text: string) => number): [string, string] {
  if (measure(text) <= height) return [text, ""];
  const segments = [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text)];
  let low = 0;
  let high = segments.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const end = middle === segments.length ? text.length : segments[middle].index;
    if (measure(text.slice(0, end)) <= height) low = middle;
    else high = middle - 1;
  }
  if (!low) return ["", text];
  let end = low === segments.length ? text.length : segments[low].index;
  // Prefer an existing paragraph/word break near the measured boundary.
  const boundaries = [...new Intl.Segmenter("th", { granularity: "word" }).segment(text.slice(0, end))];
  const boundary = boundaries.at(-1)?.index ?? 0;
  if (boundary > end * 0.8) end = boundary;
  return [text.slice(0, end), text.slice(end)];
}

export function paginateMeasuredClaim(notes: string[], m: ClaimPrintMeasurements): ClaimPrintPage[] {
  if (m.capacity <= 0 || m.blankRowHeight <= 0 || m.lineHeight <= 0) {
    throw new Error("ไม่สามารถวัดพื้นที่กระดาษได้ กรุณาลองใหม่");
  }
  const pages: ClaimPrintPage[] = [];
  const used: number[] = [];
  const newPage = () => {
    pages.push({ rowIndices: [], blankRows: 0, noteText: "", blankNoteLines: 0 });
    used.push(0);
    return pages.length - 1;
  };
  let index = newPage();
  m.rowHeights.forEach((height, rowIndex) => {
    if (height > m.capacity || height <= 0) {
      throw new Error(`ข้อความคำสั่งแถวที่ ${rowIndex + 1} ยาวเกินพื้นที่หนึ่งหน้า กรุณาตรวจสอบข้อมูลก่อนพิมพ์`);
    }
    if (pages[index].rowIndices.length === 5 || used[index] + height > m.capacity) index = newPage();
    pages[index].rowIndices.push(rowIndex);
    used[index] += height;
  });

  let remaining = notes.join("\n");
  while (remaining) {
    const height = m.capacity - used[index] - m.noteOverhead;
    const [part, rest] = height >= m.lineHeight ? takeNote(remaining, height, m.measureNote) : ["", remaining];
    if (!part) {
      if (!used[index]) throw new Error("ข้อความหมายเหตุไม่พอดีกับพื้นที่กระดาษ กรุณาตรวจสอบข้อมูลก่อนพิมพ์");
      index = newPage();
      continue;
    }
    pages[index].noteText = part;
    used[index] += m.noteOverhead + m.measureNote(part);
    remaining = rest;
    if (remaining) index = newPage();
  }

  pages.forEach((page, pageIndex) => {
    // Match the five-row form whenever the content fits. Notes-only continuations stay compact.
    const reserve = page.noteText ? 0 : m.noteOverhead + 3 * m.lineHeight;
    if (page.rowIndices.length || pageIndex === 0) {
      while (page.rowIndices.length + page.blankRows < 5 &&
        used[pageIndex] + m.blankRowHeight + reserve <= m.capacity) {
        page.blankRows++;
        used[pageIndex] += m.blankRowHeight;
      }
    }
    if (!page.noteText) {
      page.blankNoteLines = Math.max(0, Math.min(3,
        Math.floor((m.capacity - used[pageIndex] - m.noteOverhead) / m.lineHeight),
      ));
    }
  });
  return pages;
}
