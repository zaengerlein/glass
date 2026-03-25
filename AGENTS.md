# AGENTS.md — Glass

## Build & Run
- `npm run start` — build renderer + launch Electron app
- `npm run build:renderer` — esbuild renderer bundles (output: `public/build/`)
- `npm run build:web` — build Next.js web dashboard (`pickleglass_web/`)
- `npm run lint` — ESLint (`.ts`, `.tsx`, `.js`)
- No test framework is configured.

## Architecture
- **Electron desktop app** (JS, entry: `src/index.js`). Main process in `src/`, renderer UI in `src/ui/`.
- **IPC bridges** (`src/bridge/`) connect renderer ↔ main. Features: Ask (LLM Q&A), Listen (STT + summaries), Settings, Shortcuts.
- **Service + Repository pattern**: each feature has `featureService.js` + `repositories/` (SQLite adapter via `better-sqlite3`, WAL mode). DB path: `~/Library/Application Support/Glass/pickleglass.db`.
- **AI Factory** (`src/features/common/ai/factory.js`): multi-provider (OpenAI, Anthropic, Gemini, Deepgram, Ollama, Whisper). Methods: `createLLM`, `createStreamingLLM`, `createSTT`.
- **Next.js web dashboard** (`pickleglass_web/`): React 18, TypeScript, Tailwind CSS, App Router. Has its own `package.json`.
- **Encryption**: AES-256-GCM, keys in OS keychain via `keytar`.
- See `CODEBASE.md` for full schema, API routes, and Firestore structure.

## Code Style
- Prettier: 4-space indent, single quotes, semicolons, trailing commas (es5), printWidth 150, LF line endings.
- Electron app is plain JavaScript (no TS). Web dashboard (`pickleglass_web/`) uses TypeScript.
- Follow existing Service + Repository pattern for new features. Use the AI Factory for any AI provider calls.
- Sensitive data (API keys, transcripts, messages) must be encrypted via `encryptionService.js`. Never log secrets.
