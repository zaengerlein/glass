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
