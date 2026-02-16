const axios = require('axios');

async function inspect() {
    try {
        console.log("Fetching 'Top Stories' (news/rss)...");
        const url1 = "https://www.bing.com/news/rss";
        const { data: data1 } = await axios.get(url1, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
        });
        console.log("Response 1 Length:", data1.length);
        if (data1.includes('<item>')) console.log("✅ Top Stories OK");
        else console.log("❌ Top Stories Failed (No <item>). Preview:", data1.slice(0, 200));

        console.log("\nFetching 'Sport' (search?format=rss)...");
        const url2 = "https://www.bing.com/news/search?q=sport&format=rss";
        const { data: data2 } = await axios.get(url2, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
        });
        console.log("Response 2 Length:", data2.length);
        if (data2.includes('<item>')) {
            console.log("✅ Search OK");
            // Log the first link to check format
            const match = data2.match(/<link>(.*?)<\/link>/);
            if (match) console.log("Link Sample:", match[1]);
        } else {
            console.log("❌ Search Failed. Preview:", data2.slice(0, 200));
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

inspect();
