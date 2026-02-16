const axios = require('axios');
const cheerio = require('cheerio');

async function searchDDG(query) {
    console.log(`Searching DDG for: ${query}`);
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const $ = cheerio.load(data);
        // DDG HTML results are usually in .result__url or .result__a
        const firstLink = $('.result__a').first().attr('href');

        console.log(`Found Link: ${firstLink}`);
        return firstLink;
    } catch (err) {
        console.error("DDG Failed:", err.message);
    }
}

// Test with the user's article title from previous logs
const title = "5 samsung phones under N200,000 in 2026 - Vanguard News";
searchDDG(title);
