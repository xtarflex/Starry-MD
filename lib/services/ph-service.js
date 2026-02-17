import axios from 'axios';
import * as cheerio from 'cheerio';
import utils from '../core/utils.js';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': 'age_verified=1; accessAgeDisclaimerPH=2'
};

/**
 * Scrape a video page for direct MP4 links
 */
async function scrapeVideo(url) {
    try {
        console.log("[PH SERVICE] Fetching URL:", url);
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(data);
        let flashvars = null;

        const scripts = $('script');
        console.log(`[PH SERVICE] Found ${scripts.length} scripts`);

        scripts.each((i, el) => {
            const content = $(el).html() || "";
            if (content.includes('flashvars_')) {
                console.log(`[PH SERVICE] Found 'flashvars_' in script ${i}`);
                console.log(`[PH SERVICE] Script start: ${content.substring(0, 100).replace(/\n/g, '\\n')}`);

                // Robust extraction by finding the assignment and counting braces
                const assignmentMatch = content.match(/flashvars_\d+\s*=\s*/);
                if (assignmentMatch) {
                    console.log("[PH SERVICE] Assignment Match:", assignmentMatch[0]);
                    const startIndex = assignmentMatch.index + assignmentMatch[0].length;
                    let braceCount = 0;
                    let jsonString = '';
                    let foundStart = false;
                    let inString = false;
                    let escape = false;

                    for (let j = startIndex; j < content.length; j++) {
                        const char = content[j];

                        // Handle strings to ignore braces inside them
                        if (char === '"' && !escape) {
                            inString = !inString;
                        }

                        if (char === '\\' && !escape) {
                            escape = true;
                            jsonString += char;
                            continue;
                        }
                        // Reset escape if not backslash
                        if (char !== '\\') escape = false;

                        if (!inString) {
                            if (char === '{') {
                                braceCount++;
                                foundStart = true;
                            } else if (char === '}') {
                                braceCount--;
                            }
                        }

                        jsonString += char;

                        if (foundStart && braceCount === 0) {
                            break;
                        }
                    }

                    console.log("[PH SERVICE] Extracted JSON Length:", jsonString.length);
                    // console.log("[PH SERVICE] JSON Snippet:", jsonString.substring(0, 50));

                    if (foundStart && jsonString) {
                        try {
                            flashvars = JSON.parse(jsonString);
                            console.log("[PH SERVICE] JSON Parse Success. Keys:", Object.keys(flashvars));
                        } catch (e) {
                            console.error("[PH SERVICE] Failed to parse flashvars JSON:", e.message);
                            console.error("[PH SERVICE] JSON content start:", jsonString.substring(0, 100));
                        }
                    }
                } else {
                    console.log("[PH SERVICE] No assignment match found despite 'flashvars_' string");
                }
            }
        });

        if (flashvars && flashvars.mediaDefinitions) {
            console.log("[PH SERVICE] Flashvars Keys:", Object.keys(flashvars));
            console.log("[PH SERVICE] All Media Definitions:", JSON.stringify(flashvars.mediaDefinitions));
            const mp4 = flashvars.mediaDefinitions.find(d => d.format === 'mp4' && d.videoUrl);
            if (mp4 && mp4.videoUrl) {
                console.log("[PH SERVICE] Fetching API:", mp4.videoUrl);
                // Fetch the actual media URL from the API endpoint with Referer
                const mediaRes = await axios.get(mp4.videoUrl, {
                    headers: {
                        ...HEADERS,
                        'Referer': url
                    }
                });
                console.log("[PH SERVICE] API Response Type:", Array.isArray(mediaRes.data) ? "Array" : typeof mediaRes.data);

                // The API returns an array of quality objects: [{defaultQuality, format, videoUrl, quality}, ...]
                // We want the highest quality MP4
                if (Array.isArray(mediaRes.data)) {
                    console.log("[PH SERVICE] API Array Length:", mediaRes.data.length);
                    console.log("[PH SERVICE] Full Response:", mediaRes.data);
                    const best = mediaRes.data.sort((a, b) => parseInt(b.quality) - parseInt(a.quality))[0];
                    if (best && best.videoUrl) {
                        return {
                            videoUrl: best.videoUrl,
                            title: flashvars.video_title,
                            duration: parseInt(flashvars.video_duration),
                            author: "Pornhub"
                        };
                    }
                } else {
                    console.log("[PH SERVICE] API Response Body:", JSON.stringify(mediaRes.data).substring(0, 200));
                }
            } else {
                console.log("[PH SERVICE] No MP4 format found in definitions.");
            }
        } else {
            console.log("[PH SERVICE] No flashvars or mediaDefinitions found. Flashvars:", flashvars ? "Object" : "null");
            if (flashvars) console.log("[PH SERVICE] Flashvars keys:", Object.keys(flashvars));
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
                    duration: ($(el).find('.duration').text().trim() || $(el).find('var').text().trim()).replace(/[\r\n\t]+/g, ' ').split(/\s+/)[0]
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

export default {
    scrapeVideo,
    scrapeSearch,
    scrapeGifs,
    scrapePornstars,
    scrapePhotos
};
