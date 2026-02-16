
const { scrapeAlbumPhotos } = require('../lib/scrapers/ph-album');

const TEST_URLS = {
    single: "https://www.pornhub.com/photo/860192505", // User provided
    album: "https://www.pornhub.com/album/79441445"    // User provided earlier
};

async function test() {
    console.log("--- DEEP SCRAPER VERIFICATION ---");

    // Test 1: Single Photo
    console.log(`\n1. Testing Single Photo: ${TEST_URLS.single}`);
    const singleRes = await scrapeAlbumPhotos(TEST_URLS.single);
    console.log(`   Found ${singleRes.length} images.`);
    if (singleRes.length > 0) console.log(`   [SUCCESS] First Image: ${singleRes[0]}`);
    else console.log("   [FAIL] No images found.");

    // Test 2: Album
    console.log(`\n2. Testing Album: ${TEST_URLS.album}`);
    const albumRes = await scrapeAlbumPhotos(TEST_URLS.album);
    console.log(`   Found ${albumRes.length} images.`);
    if (albumRes.length > 0) {
        console.log(`   [SUCCESS] First 3 Image:`);
        albumRes.slice(0, 3).forEach(url => console.log(`   - ${url}`));
    } else {
        console.log("   [FAIL] No images found.");
    }
}

test();
