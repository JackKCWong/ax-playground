import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Estimate token count for a text file to check if it fits in LLM context window
 */

// Recent LLM context window sizes (in tokens)
const CONTEXT_WINDOWS = {
  'GPT-4o': 128000,
  'GPT-4o-mini': 128000,
  'o1': 200000,
  'o3': 200000,
  'GPT-4.1': 1047576,
  'GPT-4.1-mini': 1047576,
  'GPT-4.1-nano': 1047576,
  'GPT-5': 400000,
  'GPT-5-mini': 400000,
  'GPT-5-nano': 400000,
  'Gemini 2.0 Flash': 1048576,
  'Gemini 2.5 Flash': 1048576,
  'Gemini 2.5 Pro': 1048576,
  'Gemini 3.0 Flash': 1048576,
  'Gemini 3.0 Pro': 1048576,
};

/**
 * Rough token estimation using common heuristics:
 * - 1 token ≈ 4 characters for English
 * - 1 token ≈ 1-2 Chinese characters
 * This is an approximation; actual count depends on the tokenizer
 */
function estimateTokens(text: string): { tokens: number; chars: number; words: number; lines: number } {
  const chars = text.length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const lines = text.split('\n').length;

  // Estimate: mix of English and Chinese
  // Count non-ASCII characters (likely CJK)
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const asciiChars = chars - cjkChars;

  // Approximation: 4 chars/token for ASCII, 1.5 chars/token for CJK
  const estimatedTokens = Math.ceil(asciiChars / 4) + Math.ceil(cjkChars / 1.5);

  return { tokens: estimatedTokens, chars, words, lines };
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: tsx token-estimate.ts <file> [context_window]');
    console.log('');
    console.log('Estimate if a text file fits in LLM context window');
    console.log('');
    console.log('Arguments:');
    console.log('  file             Path to the text file');
    console.log('  context_window   Optional: target context size (default: 128000)');
    console.log('');
    console.log('Available context windows:');
    for (const [name, size] of Object.entries(CONTEXT_WINDOWS)) {
      console.log(`  ${name}: ${formatNumber(size)}`);
    }
    process.exit(1);
  }

  const filePath = resolve(args[0]);
  const targetContext = args[1] ? parseInt(args[1], 10) : 128000;

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const text = readFileSync(filePath, 'utf-8');
  const stats = estimateTokens(text);

  console.log('═══════════════════════════════════════════════════');
  console.log('  Token Estimation Report');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log(`File: ${filePath}`);
  console.log('');
  console.log('───────────────────────────────────────────────────');
  console.log('  Statistics');
  console.log('───────────────────────────────────────────────────');
  console.log(`  Characters:    ${formatNumber(stats.chars)}`);
  console.log(`  Words:         ${formatNumber(stats.words)}`);
  console.log(`  Lines:         ${formatNumber(stats.lines)}`);
  console.log(`  Est. Tokens:   ${formatNumber(stats.tokens)}`);
  console.log('');
  console.log('───────────────────────────────────────────────────');
  console.log('  Context Window Fit');
  console.log('───────────────────────────────────────────────────');

  for (const [name, size] of Object.entries(CONTEXT_WINDOWS)) {
    const fits = stats.tokens <= size;
    const percentage = ((stats.tokens / size) * 100).toFixed(1);
    const icon = fits ? '✓' : '✗';
    console.log(`  ${icon} ${name.padEnd(15)} ${formatNumber(size).padStart(10)}  (${percentage}%)`);
  }

  console.log('');
  console.log('───────────────────────────────────────────────────');
  console.log('  Target Context');
  console.log('───────────────────────────────────────────────────');
  console.log(`  Window Size:   ${formatNumber(targetContext)}`);
  const targetFits = stats.tokens <= targetContext;
  const remaining = targetContext - stats.tokens;
  console.log(`  Status:        ${targetFits ? '✓ FITS' : '✗ EXCEEDS'}`);
  console.log(`  Remaining:     ${formatNumber(remaining)} tokens`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('Note: This is a rough estimation. Actual token count');
  console.log('depends on the specific tokenizer used by the model.');

  if (!targetFits) {
    process.exit(1);
  }
}

main();
