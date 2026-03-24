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

const OPENAI_DISPLAY_NAMES = {
    'o4-mini': 'O4 Mini',
    'o3': 'O3',
    'o3-mini': 'O3 Mini',
    'o1': 'O1',
    'o1-mini': 'O1 Mini',
    'o1-preview': 'O1 Preview',
    'gpt-4.1': 'GPT-4.1',
    'gpt-4.1-mini': 'GPT-4.1 Mini',
    'gpt-4.1-nano': 'GPT-4.1 Nano',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4': 'GPT-4',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'gpt-4o-transcribe': 'GPT-4o Transcribe',
    'gpt-4o-mini-transcribe': 'GPT-4o Mini Transcribe',
};

function formatOpenAIModelName(id) {
    // Exact match first
    if (OPENAI_DISPLAY_NAMES[id]) return OPENAI_DISPLAY_NAMES[id];

    // Try without date suffix (e.g., gpt-4o-2024-11-20)
    const withoutDate = id.replace(/-\d{4}-\d{2}-\d{2}$/, '');
    if (OPENAI_DISPLAY_NAMES[withoutDate]) {
        const date = id.match(/(\d{4}-\d{2}-\d{2})$/)?.[1];
        return `${OPENAI_DISPLAY_NAMES[withoutDate]} (${date})`;
    }

    // Fallback: basic formatting
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

    const allModels = data.data;

    const llmExclude = /instruct|realtime|audio|search|embedding|vision|dall|tts|babbage|davinci|curie|ada/i;
    const llmInclude = /^(gpt-4|gpt-3\.5|o1|o3|o4)/;
    const llmModels = allModels
        .filter(m => llmInclude.test(m.id) && !llmExclude.test(m.id))
        .sort((a, b) => (b.created || 0) - (a.created || 0))
        .map(m => ({ id: m.id, name: formatOpenAIModelName(m.id) }));

    const sttInclude = /transcribe|whisper/i;
    const sttExclude = /tts/i;
    const sttModels = allModels
        .filter(m => sttInclude.test(m.id) && !sttExclude.test(m.id))
        .sort((a, b) => (b.created || 0) - (a.created || 0))
        .map(m => ({ id: m.id, name: formatOpenAIModelName(m.id) }));

    console.log(`[ModelFetcher] OpenAI: ${llmModels.length} LLM, ${sttModels.length} STT models found`);
    return { llmModels, sttModels };
}

// --- Anthropic ---

const ANTHROPIC_DISPLAY_NAMES = {
    'claude-opus-4': 'Claude Opus 4',
    'claude-sonnet-4': 'Claude Sonnet 4',
    'claude-3-7-sonnet': 'Claude 3.7 Sonnet',
    'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
    'claude-3-5-haiku': 'Claude 3.5 Haiku',
    'claude-3-opus': 'Claude 3 Opus',
    'claude-3-sonnet': 'Claude 3 Sonnet',
    'claude-3-haiku': 'Claude 3 Haiku',
};

function formatAnthropicModelName(id) {
    // Try matching without date suffix
    const withoutDate = id.replace(/-\d{8}$/, '');
    if (ANTHROPIC_DISPLAY_NAMES[withoutDate]) {
        return ANTHROPIC_DISPLAY_NAMES[withoutDate];
    }

    // Also try with "latest" suffix removed
    const withoutLatest = withoutDate.replace(/-latest$/, '');
    if (ANTHROPIC_DISPLAY_NAMES[withoutLatest]) {
        return `${ANTHROPIC_DISPLAY_NAMES[withoutLatest]} (Latest)`;
    }

    // Fallback
    return id
        .replace(/-\d{8}$/, '')
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
        .replace(/(\d) (\d)/, '$1.$2');
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

    const llmExclude = /embedding|aqa|retrieval|text-|imagen|veo|lyria|learnlm/i;
    const llmModels = models
        .filter(m =>
            m.supportedGenerationMethods?.includes('generateContent') &&
            !llmExclude.test(m.name)
        )
        .reverse() // API returns oldest first, we want newest first
        .map(m => ({
            id: m.name.replace('models/', ''),
            name: m.displayName || m.name.replace('models/', '')
        }));

    const sttModels = models
        .filter(m => /live/i.test(m.name))
        .reverse()
        .map(m => ({
            id: m.name.replace('models/', ''),
            name: m.displayName || m.name.replace('models/', '')
        }));

    console.log(`[ModelFetcher] Gemini: ${llmModels.length} LLM, ${sttModels.length} STT models found`);
    return { llmModels, sttModels };
}

module.exports = { fetchModels };
