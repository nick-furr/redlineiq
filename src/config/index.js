import 'dotenv/config';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.');
}

export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  },
  server: {
    port: parseInt(process.env.PORT) || 3001,
  },
  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB) || 50,
    maxPages: parseInt(process.env.MAX_PAGES) || 100,
    uploadDir: './uploads',
    outputDir: process.env.OUTPUT_DIR || './output',
  },
};
