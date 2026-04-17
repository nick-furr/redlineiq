# RedlineIQ

Redlined plan sets are how engineers mark up drawings for drafters to revise — handwritten annotations scattered across pages, no standard format, no built-in organization. I've worked in civil engineering and construction long enough to know how much time gets lost just interpreting and organizing that markup before any actual drafting happens. RedlineIQ automates that translation step.

AI-powered extraction of redline markup annotations from architectural and engineering drawings.

## What it does

Upload a redlined PDF → RedlineIQ uses Claude Vision to extract every markup annotation → Returns a structured checklist the drafter can work through systematically.

## Architecture

```
PDF Upload → pdf2pic (pages → images) → Claude Vision API → Structured JSON → Checklist
```

### Key files

```
src/
├── index.js                    # Express server entry point
├── config/index.js             # Environment configuration
├── models/markup.js            # Data model, types, helpers
├── services/
│   ├── db.js                   # SQLite connection and schema setup
│   ├── extraction-service.js   # Core AI extraction (Claude Vision)
│   ├── job-service.js          # Async extraction job runner + SSE events
│   └── project-service.js      # Project & checklist state management
├── routes/api.js               # REST API endpoints
├── utils/pdf-converter.js      # PDF → image conversion
└── scripts/extract-cli.js      # CLI tool for standalone extraction
```

### Data model

Each extracted markup contains:
- `id` — Unique identifier (MK-001, MK-002, ...)
- `markup_text` — The annotation content ("[illegible]" for unreadable text)
- `markup_type` — add, delete, move, modify, dimension, note, clarify, detail
- `drawing_reference` — Sheet number (A-201, C-3.1)
- `location_on_drawing` — Spatial description on the sheet
- `related_to` — Links cloud/circle annotations to their text notes
- `confidence` — high, medium, low
- `ambiguous` — Whether the intent is unclear (auto-flags for clarification)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# 3. Run tests (no API key needed)
npm test

# 4. Start the server
npm run dev
```

## Usage

### CLI (for testing extraction)

```bash
# Extract from a PDF
node src/scripts/extract-cli.js ./path/to/redlined-drawing.pdf

# Extract specific pages with verbose output
node src/scripts/extract-cli.js ./drawing.pdf --pages 1,3 --verbose

# Save results to file
node src/scripts/extract-cli.js ./drawing.pdf --output ./results.json
```

### API

```bash
# Upload a PDF and create a project
curl -X POST http://localhost:3001/api/projects \
  -F "pdf=@./drawing.pdf" \
  -F "name=Kitchen Renovation"

# Run extraction (returns jobId, then stream progress via SSE)
curl -X POST http://localhost:3001/api/projects/{id}/extract

# Stream extraction progress
curl -N http://localhost:3001/api/jobs/{jobId}/status

# Update a checklist item
curl -X PATCH http://localhost:3001/api/projects/{id}/items/MK-001 \
  -H "Content-Type: application/json" \
  -d '{"status": "done", "notes": "Updated in CAD"}'

# Flag an item for clarification
curl -X POST http://localhost:3001/api/projects/{id}/items/MK-002/flag \
  -H "Content-Type: application/json" \
  -d '{"message": "Cannot read dimension — is this 4'\''6\" or 4'\''8\"?"}'

# Get project summary
curl http://localhost:3001/api/projects/{id}/summary
```

## System requirements

- Node.js 18+
- GraphicsMagick or ImageMagick (for pdf2pic)
  - Mac: `brew install graphicsmagick`
  - Ubuntu: `sudo apt install graphicsmagick`
- An Anthropic API key

## Deployment

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Your Anthropic API key |
| `DATABASE_PATH` | No | `./data/redlineiq.db` | Path to SQLite file. On Render/Railway, point this at a persistent volume (e.g. `/var/data/redlineiq.db`) so data survives redeploys. |
| `DEMO_MODE` | No | `false` | Set to `true` to require `X-Demo-Key` header on POST /extract. GET routes stay public. |
| `DEMO_KEY` | If DEMO_MODE=true | — | The key callers must supply in the `X-Demo-Key` request header to run extractions. |
| `MAX_FILE_SIZE_MB` | No | `20` | Max PDF upload size in MB. |
| `MAX_PAGES` | No | `10` | Max pages per PDF. Checked at upload and again before extraction. |
| `PORT` | No | `3001` | HTTP port. |

### Render / Railway notes

- Add a **persistent disk** mounted at `/var/data` and set `DATABASE_PATH=/var/data/redlineiq.db`. Without a persistent disk the SQLite file lives in the ephemeral container filesystem and is wiped on every redeploy.
- The `uploads/` directory is also ephemeral — uploaded PDFs won't survive a redeploy. This is fine for a demo; for production you'd move uploads to object storage (S3/R2).
- Set `DEMO_MODE=true` and a strong `DEMO_KEY` before making the deployment public.

## Next steps

- [ ] Real-time extraction progress via WebSocket/SSE ✓ (done — uses SSE via job-service)
- [ ] React frontend with split-panel layout (PDF viewer + checklist) ✓ (done — see /client)
- [ ] Clarification workflow (engineer response loop)
- [ ] Export progress report as PDF/CSV
