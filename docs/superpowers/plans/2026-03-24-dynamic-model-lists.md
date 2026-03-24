# Dynamic Model Lists — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dynamically load available LLM and STT models from provider APIs, cache them in SQLite, and refresh in the background on app start.

**Architecture:** Each cloud provider (OpenAI, Anthropic, Gemini) gets a `fetchAvailableModels(apiKey)` static method. A new `modelFetcher.js` orchestrates fetching across providers. Results are cached in a `model_cache` SQLite table. `modelStateService.initialize()` loads cache on startup and triggers background refresh. `factory.js` gets an `updateProviderModels()` function to update PROVIDERS at runtime.

**Tech Stack:** Node.js, SQLite (better-sqlite3), fetch API

**Spec:** `docs/superpowers/specs/2026-03-24-dynamic-model-lists-design.md`

---

### Task 1: Add model_cache table to SQLite schema

**Files:**
- Modify: `src/features/common/config/schema.js`

- [ ] **Step 1: Add model_cache table definition**

In `src/features/common/config/schema.js`, add after the `permissions` table (before the closing `};`):

```javascript
    model_cache: {
        columns: [
            { name: 'provider', type: 'TEXT PRIMARY KEY' },
            { name: 'llm_models_json', type: "TEXT DEFAULT '[]'" },
            { name: 'stt_models_json', type: "TEXT DEFAULT '[]'" },
            { name: 'fetched_at', type: 'INTEGER DEFAULT 0' }
        ]
    }
```

- [ ] **Step 2: Verify app starts and creates the table**

```bash
cd /Users/joe/Projects/glass && npm start
```

Check logs for `[DB Sync] Creating table: model_cache` on first run.

- [ ] **Step 3: Commit**

```bash
git add src/features/common/config/schema.js
git commit -m "feat: add model_cache table to SQLite schema"
```

---

### Task 2: Add updateProviderModels() to factory.js

**Files:**
- Modify: `src/features/common/ai/factory.js`

- [ ] **Step 1: Add updateProviderModels function**

Add this function before the `module.exports` block:

```javascript
function updateProviderModels(provider, llmModels, sttModels) {
    if (!PROVIDERS[provider]) {
        console.warn(`[Factory] Cannot update models for unknown provider: ${provider}`);
        return;
    }
    if (llmModels && llmModels.length > 0) {
        PROVIDERS[provider].llmModels = llmModels;
    }
    if (sttModels && sttModels.length > 0) {
        PROVIDERS[provider].sttModels = sttModels;
    }
    console.log(`[Factory] Updated models for ${provider}: ${llmModels?.length || 0} LLM, ${sttModels?.length || 0} STT`);
}
```

- [ ] **Step 2: Export the new function**

Add `updateProviderModels` to the `module.exports` object.

- [ ] **Step 3: Also expand Deepgram hardcoded models**

Replace the Deepgram sttModels array:

```javascript
  'deepgram': {
    name: 'Deepgram',
    handler: () => require("./providers/deepgram"),
    llmModels: [],
    sttModels: [
        { id: 'nova-3', name: 'Nova-3' },
        { id: 'nova-2', name: 'Nova-2' },
        { id: 'nova', name: 'Nova' },
        { id: 'enhanced', name: 'Enhanced' },
        { id: 'base', name: 'Base' },
    ],
  },
```

- [ ] **Step 4: Commit**

```bash
git add src/features/common/ai/factory.js
git commit -m "feat: add updateProviderModels() to factory and expand Deepgram models"
```

---

### Task 3: Create modelFetcher.js with OpenAI support

**Files:**
- Create: `src/features/common/ai/modelFetcher.js`

- [ ] **Step 1: Create the modelFetcher module**

Create `src/features/common/ai/modelFetcher.js`:

```javascript
const FETCH_TIMEOUT = 10000; // 10 seconds

/**
 * Fetch available models for a provider using their API.
 * Returns { llmModels, sttModels } or null on failure.
 */
async function fetchModels(provider, apiKey) {
    if (!apiKey || apiKey === 'local') return null;

    try {
        switch (provider) {
            case 'openai':
                return await fetchOpenAIModels(apiKey);
            case 'anthropic':
                return await fetchAnthropicModels(apiKey);
            case 'gemini':
                return await fetchGeminiModels(apiKey);
            default:
                return null;
        }
    } catch (error) {
        console.error(`[ModelFetcher] Failed to fetch models for ${provider}:`, error.message);
        return null;
    }
}

async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

// --- OpenAI ---

function formatOpenAIModelName(id) {
    return id
        .replace(/^gpt-/, 'GPT-')
        .replace(/^o(\d)/, 'O$1')
        .replace(/-mini/, ' Mini')
        .replace(/-transcribe/, ' Transcribe');
}

async function fetchOpenAIModels(apiKey) {
    const response = await fetchWithTimeout('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!response.ok) {
        console.warn(`[ModelFetcher] OpenAI models API returned ${response.status}`);
        return null;
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data)) return null;

    const allModels = data.data.map(m => m.id);

    const llmExclude = /instruct|realtime|audio|search|embedding|vision|dall|tts|babbage|davinci|curie|ada/i;
    const llmInclude = /^(gpt-4|gpt-3\.5|o1|o3|o4)/;
    const llmModels = allModels
        .filter(id => llmInclude.test(id) && !llmExclude.test(id))
        .sort()
        .reverse()
        .map(id => ({ id, name: formatOpenAIModelName(id) }));

    const sttInclude = /transcribe|whisper/i;
    const sttExclude = /tts/i;
    const sttModels = allModels
        .filter(id => sttInclude.test(id) && !sttExclude.test(id))
        .sort()
        .reverse()
        .map(id => ({ id, name: formatOpenAIModelName(id) }));

    console.log(`[ModelFetcher] OpenAI: ${llmModels.length} LLM, ${sttModels.length} STT models found`);
    return { llmModels, sttModels };
}

// --- Anthropic ---

function formatAnthropicModelName(id) {
    // claude-sonnet-4-20250514 → Claude Sonnet 4
    // claude-3-5-sonnet-20241022 → Claude 3.5 Sonnet
    return id
        .replace(/-\d{8}$/, '')          // Remove date suffix
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
        .replace(/(\d) (\d)/, '$1.$2');  // "3 5" → "3.5"
}

async function fetchAnthropicModels(apiKey) {
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        }
    });

    if (!response.ok) {
        console.warn(`[ModelFetcher] Anthropic models API returned ${response.status}`);
        return null;
    }

    const data = await response.json();
    const models = data.data || [];

    const llmModels = models
        .filter(m => m.id.startsWith('claude-'))
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        .map(m => ({ id: m.id, name: formatAnthropicModelName(m.id) }));

    console.log(`[ModelFetcher] Anthropic: ${llmModels.length} LLM models found`);
    return { llmModels, sttModels: [] };
}

// --- Gemini ---

async function fetchGeminiModels(apiKey) {
    const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
        console.warn(`[ModelFetcher] Gemini models API returned ${response.status}`);
        return null;
    }

    const data = await response.json();
    const models = data.models || [];

    const llmExclude = /embedding|aqa|retrieval|text-/i;
    const llmModels = models
        .filter(m =>
            m.supportedGenerationMethods?.includes('generateContent') &&
            !llmExclude.test(m.name)
        )
        .map(m => ({
            id: m.name.replace('models/', ''),
            name: m.displayName || m.name.replace('models/', '')
        }));

    const sttModels = models
        .filter(m => /live/i.test(m.name))
        .map(m => ({
            id: m.name.replace('models/', ''),
            name: m.displayName || m.name.replace('models/', '')
        }));

    console.log(`[ModelFetcher] Gemini: ${llmModels.length} LLM, ${sttModels.length} STT models found`);
    return { llmModels, sttModels };
}

module.exports = { fetchModels };
```

- [ ] **Step 2: Commit**

```bash
git add src/features/common/ai/modelFetcher.js
git commit -m "feat: create modelFetcher with OpenAI, Anthropic, Gemini support"
```

---

### Task 4: Integrate model fetching into modelStateService

**Files:**
- Modify: `src/features/common/services/modelStateService.js`

- [ ] **Step 1: Add imports**

At the top of modelStateService.js, add after the existing requires:

```javascript
const { updateProviderModels } = require('../ai/factory');
const { fetchModels } = require('../ai/modelFetcher');
```

- [ ] **Step 2: Add cache constants and helper methods**

Add these as methods of the ModelStateService class, after the constructor:

```javascript
    // Model cache TTL: 24 hours
    static CACHE_TTL = 86400;

    _getDb() {
        const sqliteClient = require('./sqliteClient');
        return sqliteClient.getDb();
    }

    _loadModelCache() {
        try {
            const db = this._getDb();
            const rows = db.prepare('SELECT * FROM model_cache').all();
            for (const row of rows) {
                try {
                    const llmModels = JSON.parse(row.llm_models_json || '[]');
                    const sttModels = JSON.parse(row.stt_models_json || '[]');
                    if (llmModels.length > 0 || sttModels.length > 0) {
                        updateProviderModels(row.provider, llmModels, sttModels);
                        console.log(`[ModelStateService] Loaded cached models for ${row.provider}`);
                    }
                } catch (parseErr) {
                    console.warn(`[ModelStateService] Failed to parse model cache for ${row.provider}:`, parseErr.message);
                }
            }
        } catch (error) {
            console.warn('[ModelStateService] Failed to load model cache:', error.message);
        }
    }

    _saveModelCache(provider, llmModels, sttModels) {
        try {
            const db = this._getDb();
            db.prepare(`
                INSERT OR REPLACE INTO model_cache (provider, llm_models_json, stt_models_json, fetched_at)
                VALUES (?, ?, ?, ?)
            `).run(
                provider,
                JSON.stringify(llmModels),
                JSON.stringify(sttModels),
                Math.floor(Date.now() / 1000)
            );
        } catch (error) {
            console.warn(`[ModelStateService] Failed to save model cache for ${provider}:`, error.message);
        }
    }

    async _refreshModelsInBackground() {
        const allSettings = await providerSettingsRepository.getAll();
        const db = this._getDb();
        const now = Math.floor(Date.now() / 1000);

        for (const setting of allSettings) {
            if (!setting.api_key || setting.api_key === 'local') continue;
            const provider = setting.provider;

            // Check cache age
            try {
                const cached = db.prepare('SELECT fetched_at FROM model_cache WHERE provider = ?').get(provider);
                if (cached && (now - cached.fetched_at) < ModelStateService.CACHE_TTL) {
                    continue; // Cache still fresh
                }
            } catch (e) { /* no cache row, proceed to fetch */ }

            console.log(`[ModelStateService] Background refresh: fetching models for ${provider}...`);
            const result = await fetchModels(provider, setting.api_key);
            if (result) {
                updateProviderModels(provider, result.llmModels, result.sttModels);
                this._saveModelCache(provider, result.llmModels, result.sttModels);
            }
        }

        this.emit('state-updated', await this.getLiveState());
        console.log('[ModelStateService] Background model refresh complete.');
    }

    async refreshModelsForProvider(provider, apiKey) {
        const result = await fetchModels(provider, apiKey);
        if (result) {
            updateProviderModels(provider, result.llmModels, result.sttModels);
            this._saveModelCache(provider, result.llmModels, result.sttModels);
            this.emit('state-updated', await this.getLiveState());
        }
    }
```

- [ ] **Step 3: Modify initialize() to load cache and trigger background refresh**

In the `initialize()` method, add after `await this._runMigrations();` and before `this.setupLocalAIStateSync();`:

```javascript
        // Load cached model lists into PROVIDERS
        this._loadModelCache();

        // Trigger background model refresh (non-blocking)
        this._refreshModelsInBackground().catch(err => {
            console.warn('[ModelStateService] Background model refresh failed:', err.message);
        });
```

- [ ] **Step 4: Modify setApiKey() to trigger model fetch**

In the `setApiKey()` method, add after the `await providerSettingsRepository.upsert(...)` line and before `await this._autoSelectAvailableModels([]);`:

```javascript
        // Fetch models for newly configured provider (non-blocking)
        if (finalKey !== 'local') {
            this.refreshModelsForProvider(provider, finalKey).catch(err => {
                console.warn(`[ModelStateService] Model fetch for ${provider} failed:`, err.message);
            });
        }
```

- [ ] **Step 5: Commit**

```bash
git add src/features/common/services/modelStateService.js
git commit -m "feat: integrate model cache loading and background refresh into modelStateService"
```

---

### Task 5: Whisper local model detection

**Files:**
- Modify: `src/features/common/services/modelStateService.js`

- [ ] **Step 1: Add Whisper model refresh to background refresh**

Add at the end of the `_refreshModelsInBackground()` method, before the final `this.emit(...)`:

```javascript
        // Refresh Whisper local models
        try {
            const whisperService = require('./whisperService');
            if (whisperService.installState?.isInstalled || whisperService.installState?.isInitialized) {
                const installed = await whisperService.handleGetInstalledModels();
                if (installed?.success && installed.models) {
                    const whisperSttModels = installed.models.map(m => ({
                        id: m.id,
                        name: `${m.name} (${m.size})${m.installed ? '' : ' - Download'}`
                    }));
                    if (whisperSttModels.length > 0) {
                        updateProviderModels('whisper', [], whisperSttModels);
                    }
                }
            }
        } catch (err) {
            console.warn('[ModelStateService] Whisper model detection failed:', err.message);
        }
```

- [ ] **Step 2: Commit**

```bash
git add src/features/common/services/modelStateService.js
git commit -m "feat: add Whisper local model detection to background refresh"
```

---

### Task 6: Verification

- [ ] **Step 1: Build renderer**

```bash
cd /Users/joe/Projects/glass && npm run build:renderer
```

Expected: Build successful.

- [ ] **Step 2: Start app and check logs**

```bash
npm start
```

Expected logs (without API keys configured):
- `[ModelStateService] One-time setup complete.`
- `[ModelStateService] Background model refresh complete.`
- No errors about model_cache table.

- [ ] **Step 3: Verify with an API key (if available)**

Set an OpenAI API key in the app settings. Check logs for:
- `[ModelFetcher] OpenAI: N LLM, M STT models found`
- `[Factory] Updated models for openai: N LLM, M STT`
- `[ModelStateService] Loaded cached models for openai` (on next restart)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve any issues found during verification"
```
