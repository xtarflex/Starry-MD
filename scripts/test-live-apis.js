/**
 * Starry MD - Phase 4 Live API Testing
 * Tests real API responses for Info Zone commands
 */

const axios = require('axios');
const lyricsFinder = require('lyrics-finder');

console.log("\n🌟 STARRY MD - PHASE 4 LIVE API TEST 🌟");
console.log("=".repeat(50));

// Test Runner
const runLiveTests = async () => {

    // TEST 1: Wikipedia API
    console.log("\n📚 TEST 1: Wikipedia API (.wiki)");
    console.log("-".repeat(50));
    try {
        const query = "Artificial Intelligence";
        console.log(`Query: "${query}"`);

        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.trim().replace(/ /g, '_'))}`;
        const { data } = await axios.get(url);

        console.log("✅ SUCCESS!");
        console.log(`Title: ${data.title}`);
        console.log(`Extract: ${data.extract.substring(0, 150)}...`);
        if (data.thumbnail) {
            console.log(`Thumbnail: ${data.thumbnail.source}`);
        }
        console.log(`URL: ${data.content_urls.desktop.page}`);
    } catch (err) {
        console.log("❌ FAILED:", err.message);
    }

    // TEST 2: Lyrics Finder
    console.log("\n🎵 TEST 2: Lyrics Finder (.lyrics)");
    console.log("-".repeat(50));
    try {
        const song = "Shape of You";
        console.log(`Query: "${song}"`);

        const lyrics = await lyricsFinder(song, "");

        if (lyrics) {
            console.log("✅ SUCCESS!");
            console.log(`Found lyrics (${lyrics.length} chars)`);
            console.log(`Preview: ${lyrics.substring(0, 100)}...`);
        } else {
            console.log("⚠️ No lyrics found (this is normal for some songs)");
        }
    } catch (err) {
        console.log("❌ FAILED:", err.message);
    }

    // TEST 3: Weather API
    console.log("\n🌤️ TEST 3: Weather API (.weather)");
    console.log("-".repeat(50));
    try {
        const city = "London";
        console.log(`Query: "${city}"`);

        // Test text format first
        const textUrl = `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%w+%h+%m`;
        const { data: textData } = await axios.get(textUrl);

        console.log("✅ SUCCESS!");
        console.log(`Weather: ${textData}`);

        // Test image format
        const imageUrl = `https://wttr.in/${encodeURIComponent(city)}.png?m`;
        console.log(`Image URL: ${imageUrl}`);
        console.log("(Image format available for WhatsApp)");

    } catch (err) {
        console.log("❌ FAILED:", err.message);
    }

    // TEST 4: Wikipedia - Edge Case (Not Found)
    console.log("\n📚 TEST 4: Wikipedia - Not Found Case");
    console.log("-".repeat(50));
    try {
        const query = "ThisPageDoesNotExistXYZ123";
        console.log(`Query: "${query}"`);

        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const { data } = await axios.get(url);

        console.log("⚠️ Unexpected success");
    } catch (err) {
        if (err.response && err.response.status === 404) {
            console.log("✅ Correctly handled 404 error");
        } else {
            console.log("❌ Unexpected error:", err.message);
        }
    }

    // TEST 5: Weather - Invalid City
    console.log("\n🌤️ TEST 5: Weather - Invalid City");
    console.log("-".repeat(50));
    try {
        const city = "InvalidCityName123XYZ";
        console.log(`Query: "${city}"`);

        const url = `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t`;
        const { data } = await axios.get(url);

        console.log(`Response: ${data}`);
        if (data.includes("Unknown location")) {
            console.log("✅ Correctly returns unknown location message");
        } else {
            console.log("⚠️ Got response:", data);
        }
    } catch (err) {
        console.log("❌ FAILED:", err.message);
    }

    console.log("\n" + "=".repeat(50));
    console.log("🎯 LIVE API TESTING COMPLETE!");
    console.log("=".repeat(50));
    console.log("\n💡 Next Steps:");
    console.log("1. Start your bot: node index.js");
    console.log("2. Test commands in WhatsApp:");
    console.log("   - .wiki Quantum Physics");
    console.log("   - .lyrics Bohemian Rhapsody");
    console.log("   - .weather Tokyo");
    console.log("   - .ship @friend");
    console.log("   - .ttt @friend");
    console.log("\n");
};

runLiveTests().catch(console.error);
