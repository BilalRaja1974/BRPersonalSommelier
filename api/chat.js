// api/chat.js — Vercel serverless function

const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {

    // ── Disable all caching ──
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');

    // ── CORS ──
    const origin = req.headers.origin || '';
    const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [];
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ── Explicit check that API key is configured ──
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('ANTHROPIC_API_KEY is not set in environment variables');
        return res.status(500).json({
            error: 'Server configuration error: ANTHROPIC_API_KEY is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.'
        });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    try {
        const { messages, max_tokens = 500 } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Invalid request: messages array required' });
        }

        const bodySize = JSON.stringify(messages).length;
        console.log(`Request body size: ${bodySize} chars`);

        if (bodySize > 80000) {
            return res.status(400).json({ error: `Request too large (${bodySize} chars). The wine list may need to be shortened.` });
        }

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: Math.min(max_tokens, 2000),
            messages,
        });

        console.log(`Success — stop_reason: ${response.stop_reason}`);
        return res.status(200).json(response);

    } catch (err) {
        // Surface the full Anthropic error detail
        const status = err?.status || 500;
        const detail = err?.error?.error?.message
            || err?.message
            || JSON.stringify(err);
        console.error(`Anthropic error ${status}:`, detail);
        return res.status(status < 600 ? status : 500).json({ error: detail });
    }
};
