import type { PaymentScheduleResponse, CollectionTransaction } from "../types";
import { REPORT_COLORS, buildScheduleReportHtml } from "./scheduleReport";

export type ScheduleImageFormat = "png" | "svg";

/**
 * Builds a standalone, plain-inline-style HTML clone of the schedule summary/legend/table
 * suitable for html2canvas capture (no external stylesheet/class dependency). When
 * `collections` is supplied, the Status/Created columns reflect the same Collections-derived
 * values shown on screen, and a Collections column is appended.
 */
export function buildPrintableScheduleNode(
  schedule: PaymentScheduleResponse,
  collections?: CollectionTransaction[] | null,
): HTMLDivElement {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-99999px";
  container.style.width = "1400px";
  container.style.background = REPORT_COLORS.white;
  container.style.padding = "24px";
  container.style.fontFamily = "Arial, Helvetica, sans-serif";
  container.innerHTML = buildScheduleReportHtml(schedule, collections);
  return container;
}

/** Triggers a browser download of the given content. */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Renders the schedule to a canvas via a plain-styled off-screen clone (html2canvas cannot
 * parse Tailwind v4's oklch() colors), always removing the clone afterwards.
 */
async function renderScheduleCanvas(
  schedule: PaymentScheduleResponse,
  collections?: CollectionTransaction[] | null,
): Promise<HTMLCanvasElement> {
  const node = buildPrintableScheduleNode(schedule, collections);
  document.body.appendChild(node);

  try {
    const { default: html2canvas } = await import("html2canvas");
    return await html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
    });
  } finally {
    node.remove();
  }
}

/** Encodes a canvas as a PNG blob. */
function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to create PNG blob"))),
      "image/png",
    );
  });
}

/**
 * Renders the schedule and downloads it as PNG, or as an SVG that embeds the rasterized
 * PNG (a full vector re-creation of arbitrary layout isn't practical).
 */
export async function exportScheduleImage(
  schedule: PaymentScheduleResponse,
  format: ScheduleImageFormat,
  collections?: CollectionTransaction[] | null,
): Promise<void> {
  const canvas = await renderScheduleCanvas(schedule, collections);
  const filename = `schedule-${schedule?.id || "export"}.${format}`;

  if (format === "png") {
    triggerDownload(await canvasToPngBlob(canvas), filename);
  } else {
    const dataUrl = canvas.toDataURL("image/png");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}" /></svg>`;
    triggerDownload(new Blob([svg], { type: "image/svg+xml" }), filename);
  }
}

/** Whether this browser can put images on the clipboard (needs a secure context). */
export function canCopyImageToClipboard(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function" &&
    typeof ClipboardItem !== "undefined"
  );
}

/**
 * Renders the schedule and copies it to the clipboard as a PNG, ready to paste into
 * Teams, Jira, Confluence, etc. The ClipboardItem is created synchronously with a
 * pending blob so Safari still treats the write as part of the user's click.
 */
export async function copyScheduleImageToClipboard(
  schedule: PaymentScheduleResponse,
  collections?: CollectionTransaction[] | null,
): Promise<void> {
  if (!canCopyImageToClipboard()) {
    throw new Error("Copying images to the clipboard is not supported here");
  }
  const pngBlob = renderScheduleCanvas(schedule, collections).then(
    canvasToPngBlob,
  );
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": pngBlob }),
  ]);
}
