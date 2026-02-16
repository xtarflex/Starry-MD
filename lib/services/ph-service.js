const axios = require('axios');
const cheerio = require('cheerio');
const utils = require('../core/utils');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': 'age_verified=1'
};

/**
 * Scrape a video page for direct MP4 links
 */
async function scrapeVideo(url) {
    try {
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(data);
        let flashvars = null;
        $('script').each((i, el) => {
            const content = $(el).html() || "";
            if (content.includes('flashvars_')) {
                const match = content.match(/flashvars_\d+\s*=\s*({.*?});/s);
                if (match) {
                    try {
                        flashvars = JSON.parse(match[1]);
                    } catch (e) { }
                }
            }
        });

        if (flashvars && flashvars.mediaDefinitions) {
            const mp4 = flashvars.mediaDefinitions.find(d => d.format === 'mp4' && d.videoUrl);
            if (mp4 && mp4.videoUrl) {
                return {
                    videoUrl: mp4.videoUrl,
                    title: flashvars.video_title,
                    duration: parseInt(flashvars.video_duration),
                    author: "Pornhub"
                };
            }
        }
    } catch (e) {
        utils.log("WARN", `[PH Service] scrapeVideo Failed: ${e.message}`);
    }
    return null;
}

/**
 * Search for videos
 */
async function scrapeSearch(query) {
    try {
        const url = `https://www.pornhub.com/video/search?search=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(data);
        const results = [];
        $('.pcVideoListItem, li.videoBox').each((i, el) => {
            const a = $(el).find('a[href*="/view_video.php?viewkey="]').first();
            const href = a.attr('href');
            const vk = href?.split('viewkey=')[1]?.split('&')[0];
            if (vk && !results.some(r => r.viewkey === vk)) {
                results.push({
                    title: a.attr('title') || $(el).find('.title a').text().trim(),
                    link: `https://www.pornhub.com/view_video.php?viewkey=${vk}`,
                    viewkey: vk,
                    duration: $(el).find('.duration, var').text().trim()
                });
            }
        });
        return results;
    } catch (e) { return []; }
}

/**
 * Search for GIFs
 */
async function scrapeGifs(query) {
    try {
        const url = `https://www.pornhub.com/gifs/search?search=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(data);
        const gifs = [];
        $('.gifVideoBlock').each((i, el) => {
            const mp4 = $(el).find('video.js-gifVideo').attr('data-mp4');
            if (mp4) gifs.push({ title: $(el).find('.title').text().trim() || "Pornhub GIF", link: mp4 });
        });
        return gifs;
    } catch (e) { return []; }
}

/**
 * Search for Pornstars
 */
async function scrapePornstars(query) {
    try {
        const url = `https://www.pornhub.com/pornstars/search?search=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(data);
        const stars = [];
        $('#pornstarsSearchResult li').each((i, el) => {
            const name = $(el).find('a.title').text().trim();
            const link = $(el).find('a.title').attr('href');
            if (name && link) stars.push({ name, link: `https://www.pornhub.com${link}`, rank: $(el).find('.rank_number').text().trim(), videos: $(el).find('.videosNumber').text().trim(), views: $(el).find('.pstarViews').text().trim() });
        });
        return stars;
    } catch (e) { return []; }
}

/**
 * Search for Photo Albums
 */
async function scrapePhotos(query) {
    try {
        const url = `https://www.pornhub.com/albums/female-straight-uncategorized?search=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(data);
        const albums = [];
        $('.photoAlbumListContainer').each((i, el) => {
            const link = $(el).find('a[href^="/album/"]').attr('href');
            if (link) albums.push({ title: $(el).find('.title-album').text().trim(), link: `https://www.pornhub.com${link}`, count: $(el).find('.album-photo-counter').text().trim(), rating: $(el).find('.album-photo-percentage').text().trim(), cover: $(el).find('.photoAlbumListBlock').attr('data-bkg') });
        });
        return albums;
    } catch (e) { return []; }
}

module.exports = {
    scrapeVideo,
    scrapeSearch,
    scrapeGifs,
    scrapePornstars,
    scrapePhotos
};
