import axios from 'axios';
import * as cheerio from 'cheerio';
import utils from '../utils.js';

/**
 * Scrape high-res photos from a Pornhub album or single photo page
 * @param {string} url 
 * @returns {Promise<Array>} List of image URLs
 */
async function scrapeAlbumPhotos(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': 'age_verified=1'
            },
            timeout: 10000
        });
        const $ = cheerio.load(data);
        const images = [];

        // CASE 1: Single Photo Page (/photo/12345)
        if (url.includes('/photo/')) {
            console.log("[DEBUG] Detected Single Photo Page");
            // Values observed: #photoImageSection .centerImage img
            const mainImg = $('#photoImageSection img').attr('src') ||
                $('#photoImageSection img').attr('data-src');

            if (mainImg) {
                images.push(mainImg);
            } else {
                // Fallback for single photo
                $('img').each((i, el) => {
                    const src = $(el).attr('src') || "";
                    if (src.includes('/original_') || src.includes('large')) {
                        images.push(src);
                    }
                });
            }
        }
        // CASE 2: Album Page
        else {
            console.log("[DEBUG] Detected Album Page");

            // Strategy 1: li elements with id="photo_" (Standard Album)
            $('li[id*="photo_"]').each((i, el) => {
                let bkg = $(el).attr('data-bkg') || $(el).find('[data-bkg]').attr('data-bkg');
                let src = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
                let style = $(el).attr('style') || $(el).find('[style*="background"]').attr('style') || "";
                let styleMatch = style.match(/url\(['"]?(.*?)['"]?\)/);

                let imgUrl = bkg || src || (styleMatch ? styleMatch[1] : null);
                if (imgUrl) images.push(imgUrl);
            });

            // Strategy 2: Thumbslider / thumbimage (User suggested)
            if (images.length === 0) {
                $('.thumbimage, #thumbslider img').each((i, el) => {
                    const src = $(el).attr('data-src') || $(el).attr('src');
                    if (src) images.push(src);
                });
            }
        }

        // Clean and Deduplicate
        const uniqueImages = [...new Set(images)].map(imgUrl => {
            // Remove resizing params: (m=...) (mh=...)
            let clean = imgUrl.replace(/\(m=[^)]+\)/, '').replace(/\(mh=[^)]+\)/, '');
            // Fix protocol
            if (clean.startsWith('//')) clean = 'https:' + clean;
            return clean;
        }).filter(url => url.includes('phncdn.com')); // Basic validation

        return uniqueImages;
    } catch (e) {
        utils.log("WARN", `[PH Scraper] Failed: ${e.message}`);
        return [];
    }
}

export { scrapeAlbumPhotos };
