import type { PaymentScheduleResponse, CollectionTransaction } from '../types';
import { REPORT_COLORS, buildScheduleReportHtml } from './scheduleReport';

export type ScheduleImageFormat = 'png' | 'svg';

/**
 * Builds a standalone, plain-inline-style HTML clone of the schedule summary/legend/table
 * suitable for html2canvas capture (no external stylesheet/class dependency). When
 * `collections` is supplied, the Status/Created columns reflect the same Collections-derived
 * values shown on screen, and a Collections column is appended.
 */
export function buildPrintableScheduleNode(
  schedule: PaymentScheduleResponse,
  collections?: CollectionTransaction[] | null
): HTMLDivElement {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-99999px';
  container.style.width = '1400px';
  container.style.background = REPORT_COLORS.white;
  container.style.padding = '24px';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.innerHTML = buildScheduleReportHtml(schedule, collections);
  return container;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Renders the schedule to a canvas (via a plain-styled off-screen clone, since html2canvas
 * cannot parse Tailwind v4's oklch() colors) and downloads it as PNG, or as an SVG that
 * embeds the rasterized PNG (a full vector re-creation of arbitrary layout isn't practical).
 */
export async function exportScheduleImage(
  schedule: PaymentScheduleResponse,
  format: ScheduleImageFormat,
  collections?: CollectionTransaction[] | null
): Promise<void> {
  const node = buildPrintableScheduleNode(schedule, collections);
  document.body.appendChild(node);

  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(node, { backgroundColor: '#ffffff', scale: 2 });
    const filename = `schedule-${schedule?.id || 'export'}.${format}`;

    if (format === 'png') {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create PNG blob'))), 'image/png');
      });
      triggerDownload(blob, filename);
    } else {
      const dataUrl = canvas.toDataURL('image/png');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}" /></svg>`;
      triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), filename);
    }
  } finally {
    document.body.removeChild(node);
  }
}
