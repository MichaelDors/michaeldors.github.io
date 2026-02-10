
// Mock Data
const songs = [
    { id: 1, title: "Amazing Grace", bpm: 80, time_signature: "3/4", duration_seconds: 200, song_keys: [{ key: "G" }, { key: "C" }], links: [{ key: "C" }], files: [] },
    { id: 2, title: "Way Maker", bpm: 68, time_signature: "4/4", duration_seconds: 300, song_keys: [{ key: "E" }], links: [], files: [{ type: "pdf" }] },
    { id: 3, title: "Graves Into Gardens", bpm: 70, time_signature: "6/8", duration_seconds: 345, song_keys: [{ key: "B" }], links: [{ url: "http" }], files: [] },
    { id: 4, title: "Goodness of God", bpm: 80, time_signature: "4/4", duration_seconds: 250, song_keys: [{ key: "Ab" }], links: [], files: [] },
];

function formatDuration(seconds) {
    if (!seconds) return "";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------
// PROPOSED IMPLEMENTATION
// ---------------------------------------------------------

function parseSearchQuery(query) {
    const filters = {};
    let text = query;

    // Regex for extracting key:value pairs
    // Matches: word: followed by non-space characters or quoted string
    const regex = /(\w+):(?:"([^"]+)"|'([^']+)'|([^\s]+))/g;

    let match;
    while ((match = regex.exec(query)) !== null) {
        const key = match[1].toLowerCase();
        const value = (match[2] || match[3] || match[4] || "").toLowerCase();

        // Map keys to standard filter names
        switch (key) {
            case 'key':
                filters.key = value;
                break;
            case 'time':
            case 'ts':
            case 'signature':
            case 'timesignature':
                filters.time_signature = value;
                break;
            case 'bpm':
                filters.bpm = value;
                break;
            case 'duration':
            case 'length':
                filters.duration = value;
                break;
            case 'link':
            case 'file':
            case 'resource':
                filters.has_resource = true; // Just existence for now, can be specific if needed
                break;
        }
    }

    // Remove the matches from the text to get residual search terms
    text = query.replace(regex, "").replace(/\s+/g, " ").trim();

    return { filters, text };
}

function filterSongs(songs, query) {
    const { filters, text } = parseSearchQuery(query);
    const textLower = text.toLowerCase();

    return songs.filter(song => {
        // 1. Check Filters
        if (filters.key) {
            const songKeys = (song.song_keys || []).map(k => k.key.toLowerCase());
            // Handle "song_key" on the object itself if coming from single fetch, but usually list has song_keys
            if (song.song_key) songKeys.push(song.song_key.toLowerCase());

            if (!songKeys.includes(filters.key)) return false;
        }

        if (filters.time_signature) {
            if (!song.time_signature || song.time_signature.toLowerCase() !== filters.time_signature) return false;
        }

        if (filters.bpm) {
            if (!song.bpm || String(song.bpm) !== filters.bpm) return false;
        }

        if (filters.duration) {
            const dStr = formatDuration(song.duration_seconds);
            if (!dStr.includes(filters.duration)) return false;
        }

        if (filters.has_resource) {
            const hasLinks = song.links && song.links.length > 0;
            const hasFiles = song.files && song.files.length > 0;
            // Also check if song object has flattened structure if needed, but mock uses arrays
            if (!hasLinks && !hasFiles) return false;
        }

        // 2. Check Text (if any residual text)
        if (textLower) {
            const titleMatch = (song.title || "").toLowerCase().includes(textLower);
            // We can optionally search other fields if text is present, 
            // but typically "key:C grace" means key must be C AND title/meta matches "grace"
            if (!titleMatch) return false;
        }

        return true;
    });
}

// ---------------------------------------------------------
// TESTS
// ---------------------------------------------------------

const tests = [
    { query: "key:C", expectedIds: [1] },
    { query: "bpm:80", expectedIds: [1, 4] },
    { query: "ts:4/4", expectedIds: [2, 4] },
    { query: "resource:true", expectedIds: [1, 2, 3] }, // All except 4 have something
    { query: "bpm:80 key:G", expectedIds: [1] }, // Amazing Grace has both
    { query: "bpm:80 key:Ab", expectedIds: [4] },
    { query: "key:C Grace", expectedIds: [1] }, // search text + filter
    { query: "key:C way", expectedIds: [] }, // Filter match, text mismatch
];

console.log("Running Tests...");
let passed = 0;
tests.forEach((t, i) => {
    const results = filterSongs(songs, t.query);
    const ids = results.map(s => s.id).sort().join(",");
    const expected = t.expectedIds.sort().join(",");
    if (ids === expected) {
        console.log(`✅ Test ${i + 1} Passed: "${t.query}" -> [${ids}]`);
        passed++;
    } else {
        console.error(`❌ Test ${i + 1} Failed: "${t.query}" -> Got [${ids}], Expected [${expected}]`);
    }
});
console.log(`\n${passed}/${tests.length} passed.`);
