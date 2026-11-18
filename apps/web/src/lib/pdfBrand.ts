import type { jsPDF } from 'jspdf';
import { MARK_PNG_LIME } from '@/app/logo-art';

/** Width-to-height ratio of the STOPWASH mark. */
export const MARK_RATIO = 859 / 950;

/**
 * Draws the official lime STOPWASH mark with its top-left corner at (x, y), `height` mm tall.
 * Use it on the navy header band, never on white. Returns the mark's width in mm.
 */
export function drawBrandMark(doc: jsPDF, x: number, y: number, height: number): number {
  const width = height * MARK_RATIO;
  // A fixed alias stores the image once per document; FAST keeps the PDF small.
  doc.addImage(MARK_PNG_LIME, 'PNG', x, y, width, height, 'stopwash-mark', 'FAST');
  return width;
}
