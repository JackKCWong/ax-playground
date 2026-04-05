import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { cpus } from 'os';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

// Register pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  'file://' + path.resolve('node_modules') + '/',
).toString();

// Suppress pdfjs warnings
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const msg = args[0]?.toString() || '';
  if (
    msg.includes('JpxError') ||
    msg.includes('Unable to decode') ||
    msg.includes('Dependent image') ||
    msg.includes('JpxImage') ||
    msg.includes('OpenJPEG') ||
    msg.includes('wasmUrl') ||
    msg.includes('nullopenjpeg')
  ) {
    return; // Suppress known harmless warnings
  }
  originalWarn(...args);
};

const OUTPUT_DIR = path.resolve('pdf-pages');

function hrTimeMs(): number {
  const [sec, nsec] = process.hrtime();
  return sec * 1000 + nsec / 1e6;
}

/**
 * OCR a multi-page PDF file using all available CPUs
 * @param pdfPath - Path to the PDF file
 * @param lang - OCR language (default: 'eng')
 * @returns Array of OCR results for each page
 */
async function ocrPDF(pdfPath: string, lang: string = 'eng') {
  const numCPUs = cpus().length;
  console.log(`Available CPUs: ${numCPUs}`);

  if (!existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const absPath = path.resolve(pdfPath);
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const totalStart = hrTimeMs();

  // Load PDF document
  console.log('Loading PDF...');
  const pdfLoadStart = hrTimeMs();
  const pdfDataBuffer = await import('fs/promises').then(fs => fs.readFile(absPath));
  const pdfData = new Uint8Array(pdfDataBuffer);
  const numPages = await pdfjsLib.getDocument({ data: pdfData }).promise.then(pdf => pdf.numPages);
  const pdfLoadTime = hrTimeMs() - pdfLoadStart;
  console.log(`Total pages: ${numPages} (PDF load: ${pdfLoadTime.toFixed(0)}ms)`);

  // Process pages in parallel using all CPUs
  // Each worker: load PDF -> render page -> OCR -> save image
  const ocrStart = hrTimeMs();
  const results: Array<{ page: number; text: string; _time: number }> = new Array(numPages);
  let processedCount = 0;

  async function processPageBatch(startIndex: number) {
    const workerStart = hrTimeMs();
    const worker = await createWorker(lang);
    const workerInitTime = hrTimeMs() - workerStart;
    let workerCpuTime = 0;

    for (let i = startIndex; i < numPages; i += numCPUs) {
      const pageStart = hrTimeMs();
      const pageNum = i + 1;
      console.log(`Processing page ${pageNum}/${numPages} (Worker ${startIndex + 1})`);

      // Reload PDF for this worker
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfDataBuffer) }).promise;
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      // Render page
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const buffer = canvas.toBuffer('image/png');

      // Save image
      const outputFile = path.join(OUTPUT_DIR, `page_${pageNum}.png`);
      writeFileSync(outputFile, buffer);

      // OCR
      const { data: { text } } = await worker.recognize(buffer);
      const pageTime = hrTimeMs() - pageStart;

      results[i] = { page: pageNum, text: text.trim(), _time: pageTime };
      workerCpuTime += pageTime;

      processedCount++;
      console.log(`Progress: ${processedCount}/${numPages} pages (${pageTime.toFixed(0)}ms)`);
    }

    await worker.terminate();
    return { workerTime: hrTimeMs() - workerStart, workerInitTime };
  }

  const activeWorkers = Math.min(numCPUs, numPages);
  console.log(`Starting OCR with ${activeWorkers} workers...`);
  const workers = Array.from({ length: activeWorkers }, (_, i) => processPageBatch(i));
  const workerResults = await Promise.all(workers);

  const ocrTime = hrTimeMs() - ocrStart;
  const totalTime = hrTimeMs() - totalStart;

  // Calculate worker times
  const totalWorkerTime = workerResults.reduce((sum, w) => sum + w.workerTime, 0);
  const totalWorkerCpuTime = workerResults.reduce((sum, w) => sum + w.workerTime - w.workerInitTime, 0);

  console.log('OCR completed!');
  console.log(`\n=== Summary ===`);
  console.log(`PDF load:      ${pdfLoadTime.toFixed(0)}ms`);
  console.log(`Render+OCR:    ${ocrTime.toFixed(0)}ms clock, ${totalWorkerCpuTime.toFixed(0)}ms total worker time (${activeWorkers} workers)`);
  console.log(`TOTAL:         ${totalTime.toFixed(0)}ms`);
  console.log(`===============\n`);

  return results;
}

// Example usage
const isMain = process.argv[1]?.endsWith('ocr-pdf.ts');
if (isMain) {
  const pdfFile = process.argv[2];
  if (!pdfFile) {
    console.error('Usage: tsx ocr-pdf.ts <pdf-file-path> [language]');
    process.exit(1);
  }

  const lang = process.argv[3] || 'eng';

  ocrPDF(pdfFile, lang).then(async results => {
    const outputPath = path.join(OUTPUT_DIR, 'ocr-output.txt');
    const content = results.map(r => `=== Page ${r.page} ===\n${r.text}`).join('\n\n');
    writeFileSync(outputPath, content, 'utf-8');
    console.log(`Results saved to: ${outputPath}`);
  }).catch(err => {
    console.error('OCR failed:', err);
    process.exit(1);
  });
}

export { ocrPDF };
