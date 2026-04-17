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
    // Defaults are conservative for public demo deployments
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB) || 20,
    maxPages: parseInt(process.env.MAX_PAGES) || 10,
    uploadDir: './uploads',
    outputDir: process.env.OUTPUT_DIR || './output',
  },
  database: {
    path: process.env.DATABASE_PATH || './data/redlineiq.db',
  },
  demo: {
    // When true, POST /extract requires the X-Demo-Key header to match DEMO_KEY.
    // GET routes (viewing existing projects) remain public.
    enabled: process.env.DEMO_MODE === 'true',
    key: process.env.DEMO_KEY || '',
  },
};
