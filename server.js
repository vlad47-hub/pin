const express = require('express');
const https = require('https');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.static('.'));
app.use(express.json());

// --- LOGGING SYSTEM ---
const log = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
    warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
    error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
    api: (method, url) => console.log(`\x1b[35m[API CALL]\x1b[0m ${method} -> ${url}`)
};

const getHeaders = () => ({
    'Authorization': `Bearer ${process.env.PINTEREST_ACCESS_TOKEN.trim()}`,
    'Accept': 'application/json'
});

// --- ROUTE: GET ALL BOARDS & PINS ---
app.get('/api/dashboard/boards', async (req, res) => {
    log.info("Fetching saved media...");
    try {
        log.api("GET", "/v5/boards");
        const boards = await axios.get('https://api.pinterest.com/v5/boards', { headers: getHeaders() });
        
        const results = [];
        for (const board of boards.data.items) {
            log.info(`Reading Board: "${board.name}"`);
            const pins = await axios.get(`https://api.pinterest.com/v5/boards/${board.id}/pins`, { headers: getHeaders() });
            
            results.push({
                name: board.name,
                pins: pins.data.items.map(p => ({
                    id: p.id,
                    title: p.title || "Untitled",
                    url: p.media?.images?.['1200x']?.url || p.media?.images?.['originals']?.url || p.media?.images?.['600x']?.url
                }))
            });
        }
        log.success("Media phase complete.");
        res.json(results);
    } catch (e) {
        log.error(`Auth/API Error: ${e.response?.data?.message || e.message}`);
        res.status(500).json(e.response?.data || e.message);
    }
});

// --- ROUTE: GLOBAL SEARCH ---
// Note: In Trial Tier, this only searches your own account pins.
app.get('/api/dashboard/search', async (req, res) => {
    const query = req.query.q;
    log.info(`Global Search requested: "${query}"`);
    try {
        log.api("GET", `/v5/search/pins?query=${query}`);
        const response = await axios.get(`https://api.pinterest.com/v5/search/pins`, {
            params: { query: query },
            headers: getHeaders()
        });

        const items = response.data.items || [];
        log.success(`Search returned ${items.length} pins.`);
        
        res.json(items.map(p => ({
            id: p.id,
            title: p.title || "Global Discovery",
            url: p.media?.images?.['1200x']?.url || p.media?.images?.['600x']?.url || p.media?.images?.['originals']?.url,
            boardName: "SEARCH RESULT"
        })));
    } catch (e) {
        log.error(`Search Error: ${e.response?.status} - ${e.response?.data?.message || e.message}`);
        res.status(500).json(e.response?.data || e.message);
    }
});

// --- HTTPS SSL CONFIGURATION (Termux) ---
const sslOptions = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert')
};

const PORT = 3000;
https.createServer(sslOptions, app).listen(PORT, '0.0.0.0', () => {
    console.clear();
    console.log(`\x1b[31m PHAZR SECURE SEARCH ENGINE \x1b[0m`);
    log.success(`Server active on https://localhost:${PORT}`);
});
