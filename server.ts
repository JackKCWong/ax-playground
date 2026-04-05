import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ai, ax, AxBootstrapFewShot, type AxMetricFn } from '@ax-llm/ax';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Request body parser helper
function parseRequestBody(req): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Handle /optimize POST endpoint
  if (req.url === '/optimize' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const { systemPrompt, signatures, examples } = body;

      if (!systemPrompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'systemPrompt is required' }));
        return;
      }

      console.log('Starting optimization...');
      console.log('System prompt:', systemPrompt);
      console.log('Signatures:', signatures);
      console.log('Examples count:', examples?.length || 0);

      // Initialize LLMs - qwen3-max as teacher, qwen-flash as student
      const teacherAI = ai({
        name: 'openai',
        apiKey: process.env.DASHSCOPE_API_KEY!,
        apiURL: process.env.DASHSCOPE_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        config: {
          model: 'qwen3-max'
        },
      });

      const studentAI = ai({
        name: 'openai',
        apiKey: process.env.DASHSCOPE_API_KEY!,
        apiURL: process.env.DASHSCOPE_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        config: {
          model: 'qwen-flash'
        },
      });

      // Create program from signature
      const program = ax(signatures.trim());

      // Convert examples to format expected by AxBootstrapFewShot
      // Each example should have input fields matching the signature input and output fields matching signature output
      const trainExamples = examples?.map(ex => {
        const example: any = {};
        // Use ocr_text as input (matching signature), schedules as output
        if (ex.text) example.ocr_text = ex.text;
        if (ex.groundTruth) example.schedules = ex.groundTruth;
        return example;
      }).filter(ex => ex.ocr_text && ex.schedules) || [];

      if (trainExamples.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'At least one example with both text and groundTruth is required' }));
        return;
      }

      console.log('Training examples prepared:', JSON.stringify(trainExamples, null, 2));

      // Define metric function
      const metric: AxMetricFn = ({ prediction, example }) => {
        const output = prediction.schedules || prediction.result || prediction.output || '';
        const expected = example.schedules || '';

        if (!output || !expected) return 0;

        // Exact match gets 1.0
        if (output.trim().toLowerCase() === expected.trim().toLowerCase()) return 1.0;

        // Partial match based on keyword overlap (Jaccard similarity)
        const outputWords = new Set(output.toLowerCase().split(/\s+/));
        const expectedWords = new Set(expected.toLowerCase().split(/\s+/));
        const intersection = [...outputWords].filter(w => expectedWords.has(w));
        const union = new Set([...outputWords, ...expectedWords]);

        return intersection.length / union.size;
      };

      // Run optimization
      const optimizer = new AxBootstrapFewShot({
        studentAI,
        teacherAI,
        verbose: true,
        debugOptimizer: true,
        options: {
          maxRounds: 5,
        },
      });

      console.log('Running BootstrapFewShot optimization...');
      const result = await optimizer.compile(program, trainExamples, metric);

      console.log('Optimization complete!');
      console.log('Best score:', result.bestScore);
      

      // Extract optimized instruction
      let optimizedInstruction = systemPrompt;
      if (result.optimizedProgram && result.optimizedProgram.instruction) {
        optimizedInstruction = result.optimizedProgram.instruction;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        optimizedPrompt: optimizedInstruction,
        bestScore: result.bestScore || 0,
        demos: result.demos || [],
        stats: result.stats || {},
      }));
    } catch (error) {
      console.error('Optimization error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }));
    }
    return;
  }

  // 默认提供 index.html
  let filePath = path.join(__dirname, 'index.html');

  // 如果请求路径不是根路径，尝试提供对应文件
  if (req.url !== '/' && req.url) {
    const customPath = path.join(__dirname, req.url);
    if (fs.existsSync(customPath)) {
      filePath = customPath;
    }
  }

  const ext = path.extname(filePath);
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('404 Not Found\n');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}\n`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
