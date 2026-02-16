const snippet = "CBMinAFBVV95cUxOQVFxVlhQOHhjeFc0akkzZVhFcDhVdGdDNXgtcEY4X0IxVHg5X2tsWFZFcGMwU2RVaGJ6RTR2V0JjRVBPcGRGVTYwbkZLTEhKYVl6QXZGYlVYdll2VUFma2k1MDlPUXdobllfa3NvLWtoRGw4eTFwUXM2bW9zX3NmS2hXNGozR0g0c19Lc0JDeUd5TUk4MXdSR3Y5Njk";

// Function to decode
function decodeGoogleNewsUrl(encodedUrl) {
    try {
        // 1. Strip prefix/suffix if needed? 
        // Usually CBM... is the base64 part.

        // 2. Base64 Decode
        const buffer = Buffer.from(encodedUrl, 'base64');
        const text = buffer.toString('utf-8'); // Try utf-8
        const binary = buffer.toString('binary'); // Try binary

        console.log("--- UTF8 ---");
        console.log(text);

        console.log("\n--- BINARY (Cleaned) ---");
        // Extract anything looking like a URL
        const urlMatch = binary.match(/(https?:\/\/[^\s\x00-\x1F]+)/);
        if (urlMatch) {
            console.log("FOUND URL:", urlMatch[0]);
        } else {
            console.log("No URL found in binary.");
        }

        // 3. Try slicing method (common hack)
        // Sometimes the URL is just embedded plainly

    } catch (e) {
        console.error(e);
    }
}

decodeGoogleNewsUrl(snippet);
