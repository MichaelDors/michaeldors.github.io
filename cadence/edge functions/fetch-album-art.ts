// supabase/functions/fetch-album-art/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// CORS headers for browser-based calls
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
    imageUrl?: string;
    searchQuery?: string; // For iTunes API search
    metadataSearch?: boolean; // If true, return full results array instead of just artwork
    exactMatch?: boolean; // If true with metadataSearch, return only first result (same as album art search)
    genre?: string;
    album?: string;
    artist?: string;
    releaseDate?: string; // ISO8601 format (YYYY-MM-DD)
};

/**
 * Fetch an image URL and return it as a base64 data URL
 * This bypasses CORS restrictions on mobile browsers
 */
async function fetchImageAsDataUrl(imageUrl: string): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
    try {
        console.log(`🖼️ Fetching image: ${imageUrl}`);
        
        const response = await fetch(imageUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Cadence/1.0)',
            },
        });
        
        console.log(`🖼️ Response status: ${response.status}, ok: ${response.ok}`);
        
        if (!response.ok) {
            const error = `Failed to fetch image: ${response.status} ${response.statusText}`;
            console.error(`❌ ${error}`);
            return { success: false, error };
        }
        
        console.log(`🖼️ Converting response to blob...`);
        const blob = await response.blob();
        console.log(`🖼️ Blob size: ${blob.size} bytes, type: ${blob.type}`);
        
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log(`🖼️ ArrayBuffer size: ${uint8Array.length} bytes`);
        
        // Convert to base64 using chunked approach to handle large images
        // Build binary string in chunks to avoid stack overflow
        console.log(`🖼️ Converting to base64...`);
        let base64: string;
        try {
            const chunkSize = 8192;
            const chunks: string[] = [];
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.slice(i, Math.min(i + chunkSize, uint8Array.length));
                // Convert chunk to string
                let chunkStr = '';
                for (let j = 0; j < chunk.length; j++) {
                    chunkStr += String.fromCharCode(chunk[j]);
                }
                chunks.push(chunkStr);
            }
            const binaryString = chunks.join('');
            console.log(`🖼️ Binary string length: ${binaryString.length}`);
            
            base64 = btoa(binaryString);
            console.log(`🖼️ Base64 length: ${base64.length}`);
        } catch (base64Error) {
            console.error(`❌ Base64 conversion error: ${base64Error}`);
            throw new Error(`Base64 conversion failed: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
        }
        
        const mimeType = blob.type || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64}`;
        
        console.log(`✅ Successfully fetched and converted image (${blob.size} bytes, ${mimeType})`);
        return { success: true, dataUrl };
    } catch (error) {
        const errorMsg = `Error fetching image: ${error instanceof Error ? error.message : String(error)}`;
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(`❌ ${errorMsg}`);
        console.error(`❌ Stack: ${errorStack}`);
        return { success: false, error: `${errorMsg}${errorStack ? `\nStack: ${errorStack}` : ''}` };
    }
}

serve(async (req) => {
    console.log("🚀 fetch-album-art function called");
    console.log("📋 Request method:", req.method);
    console.log("📋 Request URL:", req.url);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        console.log("🕊️ CORS preflight handled");
        return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    let body: RequestBody;
    try {
        body = await req.json();
        console.log("📦 Request body parsed:", JSON.stringify(body, null, 2));
    } catch (err) {
        console.error("❌ Failed to parse JSON:", err);
        return new Response(
            JSON.stringify({ error: "Invalid JSON", details: String(err) }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const { imageUrl, searchQuery, metadataSearch, exactMatch, genre, album, artist, releaseDate } = body || {};

    // Handle iTunes API search
    if (searchQuery && typeof searchQuery === "string") {
        console.log("🔍 Searching iTunes API for:", searchQuery);
        if (metadataSearch) {
            console.log("📊 Metadata search enabled - exactMatch:", exactMatch, "genre:", genre, "album:", album, "artist:", artist, "releaseDate:", releaseDate);
        }
        try {
            // For exactMatch, use same search as album art (just the search query, limit 1)
            // Otherwise, combine all terms for broader search
            let combinedQuery: string;
            let limit: number;
            
            if (exactMatch && metadataSearch) {
                // Use same search as album art - just the song title, limit 1
                combinedQuery = searchQuery.trim();
                limit = 1;
            } else {
                // Build search query - combine all terms for broader search
                const searchTerms: string[] = [];
                if (searchQuery) searchTerms.push(searchQuery.trim());
                if (artist) searchTerms.push(artist.trim());
                if (album) searchTerms.push(album.trim());
                if (genre) searchTerms.push(genre.trim());
                combinedQuery = searchTerms.join(' ');
                limit = metadataSearch ? 50 : 1;
            }
            
            const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(combinedQuery)}&media=music&limit=${limit}`;
            
            const response = await fetch(itunesUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Cadence/1.0)',
                },
            });

            if (!response.ok) {
                console.error(`❌ iTunes API failed: ${response.status} ${response.statusText}`);
                return new Response(
                    JSON.stringify({ error: `iTunes API failed: ${response.status}` }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
                );
            }

            const data = await response.json();
            console.log(`✅ iTunes API returned ${data?.results?.length || 0} results`);

            // If metadata search, filter and return full results
            if (metadataSearch) {
                let filteredResults = data?.results || [];
                
                // For exactMatch, just return first result (no filtering needed - it's the same as album art)
                if (exactMatch) {
                    return new Response(
                        JSON.stringify({
                            success: true,
                            results: filteredResults.length > 0 ? [filteredResults[0]] : [],
                        }),
                        {
                            status: 200,
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                        },
                    );
                }
                
                // For broader searches, apply filters
                // Filter by genre
                if (genre) {
                    filteredResults = filteredResults.filter((item: any) => 
                        (item.primaryGenreName || '').toLowerCase().includes(genre.toLowerCase()) ||
                        (item.genres || []).some((g: string) => g.toLowerCase().includes(genre.toLowerCase()))
                    );
                }
                
                // Filter by album
                if (album) {
                    filteredResults = filteredResults.filter((item: any) => 
                        (item.collectionName || '').toLowerCase().includes(album.toLowerCase())
                    );
                }
                
                // Filter by artist
                if (artist) {
                    filteredResults = filteredResults.filter((item: any) => 
                        (item.artistName || '').toLowerCase().includes(artist.toLowerCase())
                    );
                }
                
                // Filter by release date
                if (releaseDate) {
                    const targetYear = releaseDate.split('-')[0];
                    filteredResults = filteredResults.filter((item: any) => {
                        if (!item.releaseDate) return false;
                        const itemDate = new Date(item.releaseDate);
                        const itemYear = itemDate.getFullYear().toString();
                        // Match exact date or same year
                        return item.releaseDate.startsWith(releaseDate) || itemYear === targetYear;
                    });
                }
                
                return new Response(
                    JSON.stringify({
                        success: true,
                        results: filteredResults,
                    }),
                    {
                        status: 200,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    },
                );
            }

            // Original behavior: return artwork URLs
            // If exactMatch is true, also include the full result so client can cache it
            if (data?.results?.[0]?.artworkUrl100) {
                const smallUrl = data.results[0].artworkUrl100.replace('100x100', '600x600');
                const largeUrl = data.results[0].artworkUrl100.replace('100x100', '3000x3000');
                const response: any = {
                    success: true,
                    small: smallUrl,
                    large: largeUrl,
                };
                // Include full result if exactMatch is true (for caching on client)
                if (exactMatch && data.results[0]) {
                    response.result = data.results[0];
                }
                return new Response(
                    JSON.stringify(response),
                    {
                        status: 200,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    },
                );
            }

            return new Response(
                JSON.stringify({
                    success: false,
                    error: "No artwork found in iTunes results",
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        } catch (error) {
            const errorMsg = `Error searching iTunes: ${error instanceof Error ? error.message : String(error)}`;
            console.error(`❌ ${errorMsg}`);
            return new Response(
                JSON.stringify({ error: errorMsg }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }
    }

    // Handle image fetching
    if (!imageUrl || typeof imageUrl !== "string") {
        console.error("❌ Missing or invalid imageUrl:", imageUrl);
        return new Response(
            JSON.stringify({ error: "Missing or invalid imageUrl or searchQuery" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    // Validate URL format
    try {
        new URL(imageUrl);
    } catch (urlError) {
        console.error("❌ Invalid URL format:", imageUrl);
        return new Response(
            JSON.stringify({ error: "Invalid URL format" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    // Fetch the image and convert to data URL
    const result = await fetchImageAsDataUrl(imageUrl);

    if (!result.success) {
        return new Response(
            JSON.stringify({ error: result.error || "Failed to fetch image" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    return new Response(
        JSON.stringify({
            success: true,
            dataUrl: result.dataUrl,
        }),
        {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
    );
});
