import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Find Edge browser executable path on Windows
 */
function findEdgePath(): string {
  const possiblePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(
    'Microsoft Edge not not found. Please ensure Edge is installed.'
  );
}

/**
 * Convert HTML file to PDF with A4 size using system Edge browser
 * @param inputHtml - Path to input HTML file
 * @param outputPdf - Path to output PDF file
 */
async function htmlToPdf(inputHtml: string, outputPdf: string) {
  const htmlPath = resolve(inputHtml);
  const pdfPath = resolve(outputPdf);

  if (!existsSync(htmlPath)) {
    console.error(`Error: HTML file not found: ${htmlPath}`);
    process.exit(1);
  }

  console.log(`Converting ${htmlPath} to PDF...`);

  const edgePath = findEdgePath();
  console.log(`Using Edge browser: ${edgePath}`);

  // Launch Edge in headless mode
  const browser = await chromium.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Load HTML file
    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
    console.log(`Loading: ${fileUrl}`);
    
    await page.goto(fileUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Generate PDF with A4 size
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });

    console.log(`PDF saved to: ${pdfPath}`);
  } finally {
    await browser.close();
  }
}

// CLI usage
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: tsx html-to-pdf.ts <input.html> <output.pdf>');
  console.log('');
  console.log('Examples:');
  console.log('  tsx html-to-pdf.ts index.html output.pdf');
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1] || inputFile.replace('.html', '.pdf');

htmlToPdf(inputFile, outputFile).catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
