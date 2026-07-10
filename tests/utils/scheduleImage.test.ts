import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPrintableScheduleNode, exportScheduleImage } from '../../src/utils/scheduleImage';
import { detectAndNormalizeSchedule } from '../../src/utils/scheduleDetector';
import { SAMPLE_SCHEDULES } from '../../src/constants/sampleSchedules';

const responseSample = SAMPLE_SCHEDULES.find((s) => s.format === 'response')!.json;
const { schedule } = detectAndNormalizeSchedule(responseSample);

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    width: 100,
    height: 50,
    toDataURL: () => 'data:image/png;base64,FAKE',
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['fake-png'], { type: 'image/png' }))
  }))
}));

describe('buildPrintableScheduleNode', () => {
  it('renders the schedule id, total amount, and one row per schedule item', () => {
    const node = buildPrintableScheduleNode(schedule!);
    expect(node.textContent).toContain(schedule!.id);
    expect(node.textContent).toContain('Total Amount');
    expect(node.querySelectorAll('tbody tr')).toHaveLength(schedule!.scheduleItems.length);
  });

  it('is positioned off-screen rather than display:none, so layout can be measured', () => {
    const node = buildPrintableScheduleNode(schedule!);
    expect(node.style.position).toBe('fixed');
    expect(node.style.left).toBe('-99999px');
    expect(node.style.display).not.toBe('none');
  });
});

describe('exportScheduleImage', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:fake-url');
    revokeObjectURL = vi.fn();
    (globalThis.URL as any).createObjectURL = createObjectURL;
    (globalThis.URL as any).revokeObjectURL = revokeObjectURL;
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads a PNG and removes the off-screen node afterwards', async () => {
    const bodyChildrenBefore = document.body.children.length;

    await exportScheduleImage(schedule!, 'png');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBe(bodyChildrenBefore);
  });

  it('downloads an SVG that embeds the rasterized PNG data URI', async () => {
    // Node's native Blob doesn't reliably support .text() in this test environment,
    // so capture the raw parts passed to `new Blob(...)` instead of reading it back.
    const capturedParts: BlobPart[][] = [];
    class CapturingBlob extends Blob {
      constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) {
        super(parts, options);
        capturedParts.push(parts);
      }
    }
    vi.stubGlobal('Blob', CapturingBlob);

    let capturedBlob: Blob | null = null;
    createObjectURL.mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:fake-url';
    });

    await exportScheduleImage(schedule!, 'svg');

    expect(capturedBlob).not.toBeNull();
    expect(capturedBlob!.type).toBe('image/svg+xml');
    const svgText = String(capturedParts[capturedParts.length - 1][0]);
    expect(svgText).toContain('<svg');
    expect(svgText).toContain('data:image/png;base64,FAKE');

    vi.unstubAllGlobals();
  });

  it('still removes the off-screen node when html2canvas rejects', async () => {
    const html2canvas = await import('html2canvas');
    vi.mocked(html2canvas.default).mockImplementationOnce(async () => {
      throw new Error('render failed');
    });

    const bodyChildrenBefore = document.body.children.length;
    await expect(exportScheduleImage(schedule!, 'png')).rejects.toThrow('render failed');
    expect(document.body.children.length).toBe(bodyChildrenBefore);
  });
});
