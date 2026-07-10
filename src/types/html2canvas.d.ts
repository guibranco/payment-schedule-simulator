declare module 'html2canvas' {
  interface Html2CanvasOptions {
    backgroundColor: string | null;
    scale: number;
    useCORS: boolean;
    [key: string]: unknown;
  }

  const html2canvas: (element: HTMLElement, options?: Partial<Html2CanvasOptions>) => Promise<HTMLCanvasElement>;
  export default html2canvas;
}
