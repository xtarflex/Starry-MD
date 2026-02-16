const axios = require('axios');

async function inspect() {
    try {
        console.log("Fetching Yahoo Top Stories...");
        const url1 = "https://news.yahoo.com/rss/";
        const { data: data1 } = await axios.get(url1);

        console.log("Response 1 Length:", data1.length);
        if (data1.includes('<item>')) console.log("✅ Yahoo Top Stories OK");
        else console.log("❌ Yahoo Top Stories Failed");

        console.log("\nFetching Yahoo Search 'Sport'...");
        const url2 = "https://news.search.yahoo.com/rss?p=sport";
        const { data: data2 } = await axios.get(url2);

        console.log("Response 2 Length:", data2.length);
        console.log("Preview Search:", data2.slice(0, 500)); // See what it returned
        if (data2.includes('<item>')) {
            console.log("✅ Yahoo Search OK");
            const match = data2.match(/<link>(.*?)<\/link>/);
            if (match) console.log("Link Sample:", match[1]);
            console.log("\nFetching Yahoo Categories...");
            const cats = ['science', 'health', 'entertainment', 'politics', 'us'];

            for (const cat of cats) {
                const url = `https://news.yahoo.com/rss/${cat}`;
                try {
                    const { data } = await axios.get(url);
                    if (data.includes('<item>')) console.log(`✅ Yahoo ${cat.toUpperCase()} OK`);
                    else console.log(`❌ Yahoo ${cat.toUpperCase()} Failed`);
                } catch (e) { console.log(`❌ Yahoo ${cat.toUpperCase()} Error: ${e.message}`); }
            }
        } else {
            console.log("❌ Yahoo Search Failed");
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

inspect();
