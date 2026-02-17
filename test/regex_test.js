const content = `
    <script type="text/javascript">
				var flashvars_442751601 = {"isVR":0,"mediaDefinitions":[{"group":1}],"chromecast":true,"autoFullscreen":true};
		var player_mp4_seek = "ms";
    </script>
`;

// Current regex
const regex = /flashvars_\d+\s*=\s*({.*?});/s;
const match = content.match(regex);
console.log("Match:", match ? match[1] : "No match");

if (match) {
    try {
        JSON.parse(match[1]);
        console.log("JSON Parse: Success");
    } catch (e) {
        console.log("JSON Parse: Failed -", e.message);
    }
}

// Robust parsing function
function extractFlashvars(html) {
    const startPattern = /flashvars_\d+\s*=\s*/;
    const startMatch = html.match(startPattern);

    if (!startMatch) return null;

    const startIndex = startMatch.index + startMatch[0].length;
    let braceCount = 0;
    let jsonString = '';
    let foundStart = false;

    for (let i = startIndex; i < html.length; i++) {
        const char = html[i];

        if (char === '{') {
            braceCount++;
            foundStart = true;
        } else if (char === '}') {
            braceCount--;
        }

        jsonString += char;

        if (foundStart && braceCount === 0) {
            break;
        }
    }

    return jsonString;
}

const extracted = extractFlashvars(content);
console.log("Extracted:", extracted);
try {
    JSON.parse(extracted);
    console.log("Robust Parse: Success");
} catch (e) {
    console.log("Robust Parse: Failed -", e.message);
}
