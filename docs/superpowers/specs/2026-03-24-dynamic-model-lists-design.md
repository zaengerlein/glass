# Dynamic Model Lists — Design Spec

## Goal

Dynamically load available LLM and STT models from provider APIs instead of relying solely on hardcoded lists. Models are cached in SQLite and refreshed in the background on app start.

## Architecture

### Data Flow

```
App Start
  ↓
modelStateService.initialize()
  ↓
Load model_cache from SQLite → update PROVIDERS[x].llmModels/sttModels
  ↓
Background: for each provider with valid API key → fetchModels() → update cache + PROVIDERS
  ↓
UI reads PROVIDERS as usual (no UI changes needed)
```

### New API Key Set

```
User saves API key for provider X
  ↓
modelStateService.setApiKey(provider, key)
  ↓
Immediately trigger fetchModels(provider, key)
  ↓
Update cache + PROVIDERS
  ↓
Broadcast model-state-changed to UI
```

## Provider-Specific Model Fetching

### OpenAI

**Endpoint:** `GET https://api.openai.com/v1/models`
**Auth:** `Authorization: Bearer {apiKey}`

**LLM Filter:**
- Include: ID starts with `gpt-4` or `gpt-3.5` or `o1` or `o3` or `o4`
- Exclude: ID contains `instruct`, `realtime`, `audio`, `search`, `embedding`, `-vision` (standalone)
- Sort: newest/most capable first

**STT Filter:**
- Include: ID contains `transcribe` or `whisper`
- Exclude: ID contains `tts` (text-to-speech)

**Display Name:** Derive from model ID (e.g., `gpt-4.1` → `GPT-4.1`, `gpt-4o-mini-transcribe` → `GPT-4o Mini Transcribe`)

### Anthropic

**Endpoint:** `GET https://api.anthropic.com/v1/models`
**Auth:** `x-api-key: {apiKey}`, `anthropic-version: 2023-06-01`

**LLM Filter:**
- Include: ID starts with `claude-`
- Exclude: none expected, but filter out any non-chat models if present
- Sort: newest first (by `created_at` if available)

**STT Filter:** None (Anthropic has no STT)

**Display Name:** Derive from ID (e.g., `claude-sonnet-4-20250514` → `Claude Sonnet 4`)

### Gemini

**Endpoint:** `GET https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}`
**Auth:** API key in query parameter

**LLM Filter:**
- Include: `supportedGenerationMethods` contains `generateContent`
- Exclude: name contains `embedding`, `aqa`, `retrieval`, `vision` (standalone), `text-` prefix
- Sort: by name, newest first

**STT Filter:**
- Include: name contains `live` (Gemini Live API models)

**Display Name:** Use the `displayName` field from the API response

### Deepgram (Hardcoded)

No API endpoint for model listing. Hardcode expanded list:

```javascript
sttModels: [
    { id: 'nova-3', name: 'Nova-3' },
    { id: 'nova-2', name: 'Nova-2' },
    { id: 'nova', name: 'Nova' },
    { id: 'enhanced', name: 'Enhanced' },
    { id: 'base', name: 'Base' },
]
```

### Ollama (Unchanged)

Already dynamic — reads installed models from local Ollama instance.

### Whisper (Local Detection)

On app start, call `whisperService.getInstalledModels()` to detect:
1. Whether `whisper-cpp` binary is installed
2. Which model files have been downloaded

**Display logic:**
- Installed models: shown as available
- Not-installed models: shown with download indicator (existing behavior preserved)

## Cache Schema

New SQLite table `model_cache`:

```sql
CREATE TABLE IF NOT EXISTS model_cache (
    provider TEXT PRIMARY KEY,
    llm_models_json TEXT DEFAULT '[]',
    stt_models_json TEXT DEFAULT '[]',
    fetched_at INTEGER DEFAULT 0
);
```

- `llm_models_json` / `stt_models_json`: JSON array of `{ id: string, name: string }`
- `fetched_at`: Unix timestamp (seconds) of last successful fetch
- **TTL:** 24 hours (86400 seconds). Expired cache still used as fallback while refreshing.

## New File: modelFetcher.js

`src/features/common/ai/modelFetcher.js`

Responsibilities:
- `fetchModels(provider, apiKey)` → `{ llmModels: [], sttModels: [] }`
- Provider-specific API calls and filtering
- Graceful error handling (returns null on failure, caller uses cache/defaults)
- Human-readable display name generation from model IDs

```javascript
// Public API
async function fetchModels(provider, apiKey) → { llmModels: ModelOption[], sttModels: ModelOption[] } | null
```

## Changes to Existing Files

### factory.js

- `PROVIDERS[x].llmModels` and `sttModels` remain as hardcoded defaults
- New function: `updateProviderModels(provider, llmModels, sttModels)` — replaces the model arrays at runtime
- New function: `getProviderForModel(modelId)` — updated to search current (possibly dynamic) model lists

### modelStateService.js

Changes to `initialize()`:
1. After existing init, load `model_cache` from SQLite
2. For each cached entry: call `factory.updateProviderModels(provider, cached.llmModels, cached.sttModels)`
3. Fire background refresh (non-blocking):
   - For each provider with a valid API key and expired or missing cache
   - Call `modelFetcher.fetchModels(provider, apiKey)`
   - On success: update SQLite cache + call `factory.updateProviderModels()`
   - Broadcast `model-state-changed` if models changed

Changes to `setApiKey()`:
- After saving key, trigger `fetchModels()` for that provider
- Update cache and PROVIDERS on success

### schema.js

- Add `model_cache` table to schema definition

### Provider files

Each provider file (`openai.js`, `anthropic.js`, `gemini.js`) gets a static `fetchAvailableModels(apiKey)` method on its Provider class. This keeps provider-specific logic co-located with the provider.

`modelFetcher.js` delegates to these methods.

## Error Handling

- API call fails → return null → caller uses cached or hardcoded defaults
- Invalid API key → return null (don't clear existing cache)
- Network timeout → 10 second timeout per provider
- Malformed response → log warning, return null
- Cache corruption → fall back to hardcoded defaults

## Fallback Chain

```
1. Dynamic models (from latest fetchModels call)
2. Cached models (from SQLite model_cache)
3. Hardcoded defaults (in PROVIDERS)
```

The UI always reads from `PROVIDERS` which is kept up-to-date by modelStateService.

## Out of Scope

- UI changes (model dropdown already reads from PROVIDERS)
- Model capability detection (e.g., vision support)
- Rate limiting for model list API calls
- User-defined custom model IDs
