import { MICR, MICR_CHARS, PTS_PER_INCH } from "./pdf.types.js";

// E-13B characters are drawn on a grid of 0.013" squares, 7 wide by 9 tall,
// and every character occupies a 0.125" slot (ANSI X9.100-20).
const SQUARE_IN = 0.013;
const TOLERANCE_SQUARES = 0.25;
const PITCH_TOLERANCE_PTS = 0.05;

const EXPECTED_HEIGHT_SQUARES: Record<string, number> = {
  "0": 9, "1": 9, "2": 9, "3": 9, "4": 9, "5": 9, "6": 9, "7": 9, "8": 9, "9": 9,
  [MICR_CHARS.transit]: 9,
  [MICR_CHARS.amount]: 9,
  [MICR_CHARS.onUs]: 7,
  [MICR_CHARS.dash]: 4,
};

const SITS_ON_BASELINE = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", MICR_CHARS.transit, MICR_CHARS.amount]);

const LABEL: Record<string, string> = {
  [MICR_CHARS.transit]: "transit symbol",
  [MICR_CHARS.amount]: "amount symbol",
  [MICR_CHARS.onUs]: "on-us symbol",
  [MICR_CHARS.dash]: "dash symbol",
};

export interface MicrFontReport {
  ok: boolean;
  fontPath: string;
  fontName: string;
  // Point size at which this font's characters are exactly 0.125" apart.
  fontSizePts: number;
  checkedGlyphs: number;
  problems: string[];
}

interface FontkitGlyph {
  id: number;
  advanceWidth: number;
  path: { commands: Array<{ command: string; args: number[] }> };
}

interface FontkitFont {
  unitsPerEm: number;
  fullName?: string;
  familyName?: string;
  glyphForCodePoint(codePoint: number): FontkitGlyph;
}

/**
 * Measures every MICR glyph the renderer uses and checks it against the
 * E-13B grid. Catches fonts with sabotaged glyphs (trial/demo fonts), wrong
 * symbol sizes, or a font that is not E-13B at all, before a check is printed.
 *
 * Vendors design MICR fonts for different point sizes, so the size is derived
 * from the font: the one that makes "0" advance exactly 0.125". Every other
 * measurement is taken at that size.
 */
export async function inspectMicrFont(fontPath: string): Promise<MicrFontReport> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument();
  doc.registerFont("E13B", fontPath);
  doc.font("E13B");

  // PDFKit exposes the parsed fontkit font only through this internal field.
  const font = (doc as unknown as { _font: { font: FontkitFont } })._font.font;
  doc.end();

  const problems: string[] = [];
  const zero = font.glyphForCodePoint("0".codePointAt(0)!);
  const fontSizePts =
    zero && zero.id !== 0 && zero.advanceWidth > 0
      ? (MICR.pitchPts * font.unitsPerEm) / zero.advanceWidth
      : MICR.defaultFontSizePts;

  const toSquares = (units: number) =>
    ((units / font.unitsPerEm) * fontSizePts) / PTS_PER_INCH / SQUARE_IN;
  const chars = Object.keys(EXPECTED_HEIGHT_SQUARES);

  for (const ch of chars) {
    const name = LABEL[ch] ? `"${ch}" (${LABEL[ch]})` : `"${ch}"`;
    const glyph = font.glyphForCodePoint(ch.codePointAt(0)!);

    if (!glyph || glyph.id === 0) {
      problems.push(`${name}: missing from the font`);
      continue;
    }

    const advancePts = (glyph.advanceWidth / font.unitsPerEm) * fontSizePts;
    if (Math.abs(advancePts - MICR.pitchPts) > PITCH_TOLERANCE_PTS) {
      problems.push(`${name}: advances ${(advancePts / PTS_PER_INCH).toFixed(4)}" while "0" advances 0.1250"; E-13B is fixed pitch`);
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of glyph.path.commands) {
      for (let i = 0; i + 1 < c.args.length; i += 2) {
        minX = Math.min(minX, c.args[i]!);
        maxX = Math.max(maxX, c.args[i]!);
        minY = Math.min(minY, c.args[i + 1]!);
        maxY = Math.max(maxY, c.args[i + 1]!);
      }
    }
    if (!Number.isFinite(minX)) {
      problems.push(`${name}: has no outline (prints blank)`);
      continue;
    }

    const width = toSquares(maxX - minX);
    const height = toSquares(maxY - minY);
    const bottom = toSquares(minY);
    const expectedHeight = EXPECTED_HEIGHT_SQUARES[ch]!;
    const size = `${(width * SQUARE_IN).toFixed(3)}" x ${(height * SQUARE_IN).toFixed(3)}" (${width.toFixed(2)} x ${height.toFixed(2)} squares)`;

    if (Math.abs(height - expectedHeight) > TOLERANCE_SQUARES) {
      problems.push(`${name}: ink is ${size}; E-13B height is ${expectedHeight} squares (${(expectedHeight * SQUARE_IN).toFixed(3)}")`);
    } else if (width < 4 - TOLERANCE_SQUARES || width > 7 + TOLERANCE_SQUARES || Math.abs(width - Math.round(width)) > TOLERANCE_SQUARES) {
      problems.push(`${name}: ink is ${size}; E-13B widths are whole squares from 4 to 7`);
    } else if (SITS_ON_BASELINE.has(ch) && Math.abs(bottom) > TOLERANCE_SQUARES) {
      problems.push(`${name}: ink starts ${(bottom * SQUARE_IN).toFixed(3)}" from the baseline; E-13B characters sit on it`);
    }
  }

  return {
    ok: problems.length === 0,
    fontPath,
    fontName: font.fullName ?? font.familyName ?? "unknown",
    fontSizePts: Math.round(fontSizePts * 1000) / 1000,
    checkedGlyphs: chars.length,
    problems,
  };
}
