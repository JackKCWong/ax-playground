import * as fs from 'fs';
import * as path from 'path';

interface FillOptions {
  htmlFile: string;
  jsonFile: string;
  outputFile: string;
}

function fillHtmlWithJson({ htmlFile, jsonFile, outputFile }: FillOptions): void {
  // Read input files
  const htmlContent = fs.readFileSync(htmlFile, 'utf-8');
  const jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));

  let filledHtml = htmlContent;

  // Fill text inputs
  const inputMappings: Record<string, string> = {
    'brNumber': 'brNumber',
    'companyName': 'companyName',
    'businessName': 'businessName',
    'natureCode': 'natureCode',
    'natureDescription': 'natureDescription',
    'returnDateDD': 'dateDD1',
    'returnDateMM': 'dateMM1',
    'returnDateYYYY': 'dateYYYY1',
    'periodFromDD': 'dateDD2',
    'periodFromMM': 'dateMM2',
    'periodFromYYYY': 'dateYYYY2',
    'periodToDD': 'dateDD3',
    'periodToMM': 'dateMM3',
    'periodToYYYY': 'dateYYYY3',
    'addrFlat': 'addrFlat',
    'addrBuilding': 'addrBuilding',
    'addrStreet': 'addrStreet',
    'addrDistrict': 'addrDistrict',
    'presenterName': 'presenterName',
    'presenterAddr1': 'presenterAddr1',
    'presenterAddr2': 'presenterAddr2',
    'presenterAddr3': 'presenterAddr3',
    'presenterTel': 'presenterTel',
    'presenterFax': 'presenterFax',
    'presenterEmail': 'presenterEmail',
    'presenterRef': 'presenterRef'
  };

  // Replace input values
  for (const [jsonKey, htmlId] of Object.entries(inputMappings)) {
    const value = jsonData[jsonKey] || '';
    // Match input tag with this id and add value attribute
    const inputRegex = new RegExp(`(<input[^>]*id="${htmlId}"[^>]*)>`, 'gi');
    filledHtml = filledHtml.replace(inputRegex, (match, beforeClose) => {
      // Check if value attribute already exists
      if (beforeClose.includes('value=')) {
        return match;
      }
      return `${beforeClose} value="${value}">`;
    });
  }

  // Handle checkboxes
  const checkboxMappings: Record<string, string> = {
    'typePrivate': 'typePrivate',
    'typePublic': 'typePublic',
    'typeGuarantee': 'typeGuarantee'
  };

  for (const [jsonKey, checkboxId] of Object.entries(checkboxMappings)) {
    const isChecked = jsonData[jsonKey] === true;
    const checkboxRegex = new RegExp(`(<input[^>]*id="${checkboxId}"[^>]*type="checkbox")`, 'gi');
    filledHtml = filledHtml.replace(checkboxRegex, (match) => {
      if (isChecked && !match.includes('checked')) {
        return `${match} checked`;
      } else if (!isChecked) {
        return match.replace(/\s*checked/g, '');
      }
      return match;
    });

    // Also update the visual checkbox div
    const visualBoxId = checkboxId.replace('type', 'chk');
    const visualBoxRegex = new RegExp(`(<div[^>]*id="${visualBoxId}"[^>]*class="[^"]*")`, 'gi');
    filledHtml = filledHtml.replace(visualBoxRegex, (match) => {
      if (isChecked && !match.includes('checked')) {
        return `${match} checked"`;
      } else if (!isChecked) {
        return match.replace(/\s*checked"/g, '"');
      }
      return match;
    });
  }

  // Fill nature code and description boxes (divs with text content)
  if (jsonData.natureCode) {
    const natureCodeRegex = /(<div[^>]*id="natureCodeBox"[^>]*>)[^<]*(<\/div>)/gi;
    filledHtml = filledHtml.replace(natureCodeRegex, `$1${jsonData.natureCode}$2`);
  }

  if (jsonData.natureDescription) {
    const natureDescRegex = /(<div[^>]*id="natureDescBox"[^>]*>)[^<]*(<\/div>)/gi;
    filledHtml = filledHtml.replace(natureDescRegex, `$1${jsonData.natureDescription}$2`);
  }

  // Write output file
  fs.writeFileSync(outputFile, filledHtml, 'utf-8');
  console.log(`✓ Successfully generated: ${outputFile}`);
}

// CLI usage
const args = process.argv.slice(2);

if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: ts-node fill-form.ts <json-file> <html-file> [output-file]

Arguments:
  json-file    Path to the JSON file with form data
  html-file    Path to the HTML template
  output-file  Path for the output HTML (optional, defaults to output.html)

Example:
  ts-node fill-form.ts nar1-cover.json nar1-cover.html filled-form.html
  `);
  process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
}

const htmlFile = args[1];
const jsonFile = args[0];
const outputFile = args[2] || 'output.html';

// Resolve paths
const resolvedJson = path.resolve(jsonFile);
const resolvedHtml = path.resolve(htmlFile);
const resolvedOutput = path.resolve(outputFile);

// Validate files
if (!fs.existsSync(resolvedJson)) {
  console.error(`✗ Error: JSON file not found: ${resolvedJson}`);
  process.exit(1);
}

if (!fs.existsSync(resolvedHtml)) {
  console.error(`✗ Error: HTML file not found: ${resolvedHtml}`);
  process.exit(1);
}

try {
  fillHtmlWithJson({
    htmlFile: resolvedHtml,
    jsonFile: resolvedJson,
    outputFile: resolvedOutput
  });
} catch (error) {
  console.error('✗ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}
