
const cheerio = require('cheerio');
const fs = require('fs-extra');

async function inspect() {
    try {
        const html = await fs.readFile('ph_album_debug.html', 'utf-8');
        const $ = cheerio.load(html);

        console.log("--- HTML INSPECTION ---");
        console.log(`Title: ${$('title').text()}`);

        console.log("\nSearching for potential containers...");

        console.log("\nSearching for photo items (li[id*='photo_'])...");

        $('li[id*="photo_"]').each((i, el) => {
            if (i > 2) return; // Only log first 3
            console.log(`\n[Item ${i}] ID: ${$(el).attr('id')}`);
            console.log(`Class: ${$(el).attr('class')}`);
            console.log(`Inner HTML (truncated): ${$(el).html().substring(0, 300)}...`);

            // recursive check for img
            const img = $(el).find('img');
            if (img.length) {
                console.log(`  -> Found IMG: src="${img.attr('src')}" data-src="${img.attr('data-src')}"`);
            }

            // recursive check for data-bkg
            const div = $(el).find('div');
            div.each((j, d) => {
                if ($(d).attr('data-bkg')) console.log(`  -> Found data-bkg: ${$(d).attr('data-bkg')}`);
                if ($(d).attr('style')) console.log(`  -> Found style: ${$(d).attr('style')}`);
            });
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

inspect();
