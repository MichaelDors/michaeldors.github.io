// supabase/functions/process-itunes-indexing/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// iTunes API rate limiting: ~20 requests per minute is safe
// Running every 1 minutes, we can process ~20 songs, but let's be conservative
const SONGS_PER_RUN = 10; // Process 10 songs per cron run 
const ITUNES_API_DELAY_MS = 2000; // 2 seconds between requests
const GETSONGBPM_API_DELAY_MS = 1500; // 1.5 seconds between GetSongBPM requests

interface iTunesResult {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  trackTimeMillis?: number; // Added for duration
  [key: string]: any;
}

interface GetSongBPMResult {
  song_id?: string;
  song_title?: string;
  artist?: {
    // API returns artist object or similar structure depending on endpoint
    name?: string;
  };
  tempo?: string; // API returns tempo as string usually
  key_of?: string;
  time_sig?: string; // API field for time signature
}

type FetchOutcome =
  | { kind: "success"; result: any }
  | { kind: "no_match" }
  | { kind: "failed"; status?: number; statusText?: string; error?: string };

/**
 * Fetch iTunes metadata for a song title
 */
async function fetchItunesMetadata(songTitle: string): Promise<FetchOutcome> {
  try {
    const searchQuery = encodeURIComponent(songTitle.trim());
    const apiUrl = `https://itunes.apple.com/search?term=${searchQuery}&media=music&limit=1`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Cadence/1.0)',
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ iTunes API request failed for "${songTitle}": ${response.status} ${response.statusText}`);
      return { kind: "failed", status: response.status, statusText: response.statusText };
    }

    const data = await response.json();
    if (data?.results && data.results.length > 0) {
      return { kind: "success", result: data.results[0] as iTunesResult };
    }

    return { kind: "no_match" };
  } catch (error) {
    console.error(`❌ Error fetching iTunes metadata for "${songTitle}":`, error);
    return { kind: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Fetch BPM and Key from GetSongBPM API
 */
async function fetchGetSongBPMData(songTitle: string, artistName?: string): Promise<FetchOutcome> {
  const apiKey = Deno.env.get('GETSONGBPM_API_KEY');
  if (!apiKey) {
    console.warn('⚠️ GETSONGBPM_API_KEY not found in environment variables. Skipping BPM fetch.');
    return { kind: "failed", error: "missing_api_key" };
  }

  try {
    // Construct query: use title + artist if available for better accuracy
    let searchQuery = `song:${songTitle}`;
    if (artistName) {
      searchQuery += ` artist:${artistName}`;
    }
    const encodedQuery = encodeURIComponent(searchQuery);

    // Using search endpoint
    const apiUrl = `https://api.getsong.co/search/?api_key=${apiKey}&type=both&lookup=${encodedQuery}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Cadence/1.0)',
        // Spoof the referer/origin to match the likely registered domain
        'Referer': 'https://michaeldors.com/cadence',
        'Origin': 'https://michaeldors.com',
        // Try sending key in header as well, as some endpoints prefer it
        'X-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ GetSongBPM API request failed for "${songTitle}": ${response.status} ${response.statusText}`);

      // Log the actual response body for debugging 401s or other errors
      const errorBody = await response.text();
      console.warn(`   Response Body: ${errorBody}`);

      return { kind: "failed", status: response.status, statusText: response.statusText, error: `api_${response.status}` };
    }

    const data = await response.json();
    console.log(`GetSongBPM Response for "${songTitle}":`, JSON.stringify(data).substring(0, 200) + "..."); // Log first 200 chars

    // API structure verification required. Assuming structure based on search results:
    // JSON response typically has a 'search' array
    if (data?.search && Array.isArray(data.search) && data.search.length > 0) {
      // Return the first match
      return { kind: "success", result: data.search[0] };
    }

    return { kind: "no_match" };

  } catch (error) {
    console.error(`❌ Error fetching GetSongBPM data for "${songTitle}":`, error);
    return { kind: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Fetch BPM from Deezer API
 */
async function fetchDeezerMetadata(songTitle: string, artistName?: string): Promise<FetchOutcome> {
  try {
    // Helper to process search results
    const checkCandidates = async (candidates: any[]): Promise<{ bpm: number } | null> => {
      for (const candidate of candidates) {
        console.log(`Deezer: Checking candidate "${candidate.title}" (ID: ${candidate.id})...`);
        const trackUrl = `https://api.deezer.com/track/${candidate.id}`;
        try {
          const trackRes = await fetch(trackUrl);
          if (trackRes.ok) {
            const trackData = await trackRes.json();
            if (trackData && trackData.bpm && trackData.bpm > 0) {
              console.log(`✅ Valid BPM found: ${trackData.bpm}`);
              return { bpm: trackData.bpm };
            } else {
              console.log(`⚠️ BPM was 0 or missing for candidate.`);
            }
          }
        } catch (err) {
          console.warn(`Error fetching track details for ${candidate.id}:`, err);
        }
      }
      return null;
    };

    // 1. Strict Search (limit 3)
    let searchQuery = `track:"${songTitle}"`;
    if (artistName) {
      searchQuery += ` artist:"${artistName}"`;
    }
    const encodedQuery = encodeURIComponent(searchQuery);
    const searchUrl = `https://api.deezer.com/search?q=${encodedQuery}&limit=3`;
    console.log(`🔎 Searching Deezer (Strict): ${searchUrl}`);

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      console.warn(`Deezer strict search failed: ${searchRes.status}`);
    } else {
      const searchData = await searchRes.json();
      console.log(`Deezer Strict Candidates: ${searchData.data ? searchData.data.length : 0}`);
      if (searchData.data && searchData.data.length > 0) {
        const result = await checkCandidates(searchData.data);
        if (result) return { kind: "success", result };
      }
    }

    // 2. Loose Search (Title + Artist simplified)
    if (artistName) {
      console.log("⚠️ Strict search yielded no valid BPM. Trying loose search...");
      const cleanArtist = artistName.replace(/feat\.?|&|and/gi, " ").replace(/[^\w\s]/gi, "").trim();
      const simpleQuery = `${songTitle} ${cleanArtist}`;
      const looseUrl = `https://api.deezer.com/search?q=${encodeURIComponent(simpleQuery)}&limit=3`;

      const looseRes = await fetch(looseUrl);
      if (looseRes.ok) {
        const looseData = await looseRes.json();
        console.log(`Deezer Loose Candidates: ${looseData.data ? looseData.data.length : 0}`);
        if (looseData.data && looseData.data.length > 0) {
          const result = await checkCandidates(looseData.data);
          if (result) return { kind: "success", result };
        }
      }
    }

    console.log(`Deezer: No valid BPM found for "${songTitle}" after checking all candidates.`);
    return { kind: "no_match" };

  } catch (error) {
    console.error(`❌ Error fetching Deezer data for "${songTitle}":`, error);
    return { kind: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}

function isSuspiciousRateLimitBurst(totalSongs: number, failures: Array<{ status?: number; statusText?: string; error?: string }>): boolean {
  if (totalSongs <= 0) return false;
  const failCount = failures.length;
  if (failCount === 0) return false;

  // Heuristic:
  // - If most songs in this run failed to fetch iTunes, treat as rate limiting / transient.
  // - Also treat 429/503 bursts as suspicious even at lower ratios.
  const ratio = failCount / totalSongs;
  const hasRateLimitishStatus = failures.some(f => f.status === 429 || f.status === 503);
  const manyFailures = failCount >= Math.max(5, Math.ceil(totalSongs * 0.6));

  if (manyFailures) return true;
  if (hasRateLimitishStatus && failCount >= 2 && ratio >= 0.3) return true;

  return false;
}

/**
 * Process a single song's iTunes indexing
 */
async function processSong(
  supabase: any,
  song: any,
): Promise<{ outcome: "indexed_success" | "indexed_no_match" | "fetch_failed"; status?: number; statusText?: string; error?: string }> {
  const songTitle = song.title?.trim();
  if (!songTitle) {
    console.log(`⏭️ Skipping song ${song.id} - no title`);
    return { outcome: "fetch_failed", error: "missing_title" };
  }

  console.log(`🔍 Indexing: "${songTitle}" (ID: ${song.id})`);

  // 1. Fetch iTunes Metadata
  const itunesOutcome = await fetchItunesMetadata(songTitle);

  if (itunesOutcome.kind === "failed") {
    console.log(`⚠️ iTunes fetch failed for: "${songTitle}" (will retry later unless disabled)`);
    return { outcome: "fetch_failed", status: itunesOutcome.status, statusText: itunesOutcome.statusText, error: itunesOutcome.error };
  }

  const nowIso = new Date().toISOString();
  let updates: any = {
    itunes_indexed_at: nowIso,
    itunes_fetch_failure_count: 0,
    itunes_fetch_last_failed_at: null,
    itunes_fetch_last_error: null,
    itunes_fetch_disabled: false,
    itunes_fetch_disabled_at: null,
  };

  let artistForBpm = "";

  // 2. Process iTunes Result
  if (itunesOutcome.kind === "success") {
    const itunesResult = itunesOutcome.result;

    // Extract album art URLs (small and large)
    let albumArtSmall: string | null = null;
    let albumArtLarge: string | null = null;

    if (itunesResult.artworkUrl100) {
      albumArtSmall = itunesResult.artworkUrl100.replace('100x100', '600x600');
      albumArtLarge = itunesResult.artworkUrl100.replace('100x100', '3000x3000');
    }

    // Extract Duration (trackTimeMillis -> seconds)
    let suggestedDuration = null;
    if (itunesResult.trackTimeMillis) {
      suggestedDuration = Math.round(itunesResult.trackTimeMillis / 1000);
    }

    // Capture artist name for better BPM search
    if (itunesResult.artistName) {
      artistForBpm = itunesResult.artistName;
    }

    const { artworkUrl100, artworkUrl60, ...metadataToStore } = itunesResult;

    updates = {
      ...updates,
      album_art_small_url: albumArtSmall,
      album_art_large_url: albumArtLarge,
      itunes_metadata: metadataToStore,
      suggested_duration: suggestedDuration,
    };
  } else {
    console.log(`⚠️ No iTunes data found for: "${songTitle}"`);
    updates.itunes_fetch_last_error = "no_match";
    // We continue to try BPM even if iTunes fails, though likely BPM will fail too if it's obscure
  }

  // 3. Fetch Deezer Metadata within the main function (or separate help)
  // We prioritize Deezer for BPM as it is free and reliable

  // NOTE: In a real refactor, we would move this to a helper function above, 
  // but for minimal diffs, we can inline or call a new helper.
  // Let's add the helper call here and define it below or above.

  let deezerBpm: number | null = null;
  try {
    const deezerOutcome = await fetchDeezerMetadata(songTitle, artistForBpm);
    if (deezerOutcome.kind === "success" && deezerOutcome.result.bpm) {
      deezerBpm = deezerOutcome.result.bpm;
      updates.suggested_bpm = Math.round(deezerBpm); // Prioritize Deezer BPM and ensure integer
      console.log(`✅ Found Deezer BPM: ${deezerBpm} (Rounded: ${updates.suggested_bpm})`);
    }
  } catch (err) {
    console.warn("Deezer fetch error:", err);
  }

  if (!deezerBpm) {
    console.log("ℹ️ No Deezer BPM found, falling back to other sources if available.");
  }

  // 4. Fetch GetSongBPM Metadata (for Key / Time Sig, and fallback BPM)
  // Only attempt if we have a title. Using artist from iTunes if found, or empty.

  const bpmOutcome = await fetchGetSongBPMData(songTitle, artistForBpm);

  if (bpmOutcome.kind === "success") {
    const bpmResult = bpmOutcome.result;
    console.log(`Found GetSongBPM data for ${songTitle}`);

    // Parse fields
    if (bpmResult.tempo && !deezerBpm) { // Only use if Deezer didn't find one
      const bpm = parseInt(bpmResult.tempo, 10);
      if (!isNaN(bpm)) {
        updates.suggested_bpm = bpm;
      }
    }

    if (bpmResult.key_of) {
      updates.suggested_song_key = bpmResult.key_of;
    }

    if (bpmResult.time_sig) {
      updates.suggested_time_signature = bpmResult.time_sig;
    }

  } else if (bpmOutcome.kind === "failed") {
    console.warn(`GetSongBPM fetch failed: ${bpmOutcome.error || bpmOutcome.status}`);
    // We don't fail the whole indexing if BPM fails, just log it.
  }

  // 4. Update Database
  const { error } = await supabase
    .from('songs')
    .update(updates)
    .eq('id', song.id);

  if (error) {
    console.error(`❌ Error updating song ${song.id}:`, error);
    return { outcome: "fetch_failed", error: `db_update_failed:${error.message ?? String(error)}` };
  }

  console.log(`✅ Successfully indexed: "${songTitle}"`);
  return { outcome: "indexed_success" };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Internal/global pause switch (keeps existing team settings intact)
    const indexingPaused = (Deno.env.get('ITUNES_INDEXING_PAUSED') ?? '').toLowerCase() === 'true';
    if (indexingPaused) {
      console.log('⏸️ iTunes indexing is paused via ITUNES_INDEXING_PAUSED');
      return new Response(
        JSON.stringify({ success: true, message: 'iTunes indexing is paused', processed: 0, paused: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log('🚀 Starting iTunes/BPM indexing process...');

    // Get candidate songs that need indexing (no itunes_indexed_at timestamp)
    // We fetch more than SONGS_PER_RUN so we can filter out teams with indexing disabled.
    const candidateLimit = Math.max(SONGS_PER_RUN, SONGS_PER_RUN * 5);
    const { data: candidateSongs, error: fetchError } = await supabase
      .from('songs')
      .select('id, title, team_id, itunes_fetch_failure_count, itunes_fetch_disabled')
      .is('itunes_indexed_at', null)
      // Stop trying for songs we’ve already disabled due to repeated non-suspicious failures
      .or('itunes_fetch_disabled.is.null,itunes_fetch_disabled.eq.false')
      .not('title', 'is', null)
      .limit(candidateLimit)
      .order('created_at', { ascending: true }); // Process oldest songs first

    if (fetchError) {
      throw new Error(`Failed to fetch songs: ${fetchError.message}`);
    }

    if (!candidateSongs || candidateSongs.length === 0) {
      console.log('✅ No songs need indexing');
      return new Response(
        JSON.stringify({ success: true, message: 'No songs need indexing', processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Filter out teams that have disabled indexing (team-wide toggle)
    let songsToIndex = candidateSongs as any[];
    try {
      const teamIds = Array.from(new Set((candidateSongs || []).map((s: any) => s.team_id).filter(Boolean)));
      if (teamIds.length > 0) {
        const { data: teams, error: teamsError } = await supabase
          .from('teams')
          .select('id, itunes_indexing_enabled')
          .in('id', teamIds);

        if (teamsError) {
          if (teamsError.message?.includes('itunes_indexing_enabled')) {
            console.warn('teams.itunes_indexing_enabled column missing; treating all teams as enabled');
          } else {
            console.warn('Failed to fetch team indexing settings; treating all teams as enabled:', teamsError);
          }
        } else {
          const enabledTeamIds = new Set((teams || []).filter((t: any) => t.itunes_indexing_enabled !== false).map((t: any) => t.id));
          songsToIndex = songsToIndex.filter((s: any) => enabledTeamIds.has(s.team_id));
        }
      }
    } catch (e) {
      console.warn('Failed to apply team-wide indexing filter; treating all teams as enabled:', e);
    }

    songsToIndex = (songsToIndex || []).slice(0, SONGS_PER_RUN);

    if (!songsToIndex || songsToIndex.length === 0) {
      console.log('✅ No songs need indexing (all pending songs belong to teams with indexing disabled)');
      return new Response(
        JSON.stringify({ success: true, message: 'No songs need indexing (teams disabled)', processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`📋 Found ${songsToIndex.length} songs to index (from ${candidateSongs.length} candidates)`);

    let successCount = 0;
    let failCount = 0;
    const fetchFailures: Array<{ songId: string; title: string; status?: number; statusText?: string; error?: string; prevCount?: number }> = [];

    // Process each song with rate limiting
    for (let i = 0; i < songsToIndex.length; i++) {
      const song = songsToIndex[i];
      const result = await processSong(supabase, song);

      if (result.outcome === "indexed_success" || result.outcome === "indexed_no_match") {
        successCount++;
      } else {
        failCount++;
      }

      if (result.outcome === "fetch_failed") {
        fetchFailures.push({
          songId: song.id,
          title: song.title,
          status: result.status,
          statusText: result.statusText,
          error: result.error,
          prevCount: song.itunes_fetch_failure_count ?? 0,
        });
      }

      // Rate limiting: wait between requests (except for the last one)
      if (i < songsToIndex.length - 1) {
        // Use the larger of the two delays to be safe, or sum them?
        // Let's use 2000ms as a baseline since we are making 2 requests potentially now
        await new Promise(resolve => setTimeout(resolve, Math.max(ITUNES_API_DELAY_MS, GETSONGBPM_API_DELAY_MS)));
      }
    }

    // After the run, decide whether failures looked like a rate-limit burst.
    const suspiciousBurst = isSuspiciousRateLimitBurst(songsToIndex.length, fetchFailures);
    if (fetchFailures.length > 0) {
      console.log(
        `🧯 iTunes/BPM fetch failures this run: ${fetchFailures.length}/${songsToIndex.length}. suspiciousBurst=${suspiciousBurst}`
      );
    }

    // If not suspicious, count failures per-song and disable after 3.
    if (!suspiciousBurst && fetchFailures.length > 0) {
      const nowIso = new Date().toISOString();

      for (const f of fetchFailures) {
        const nextCount = (f.prevCount ?? 0) + 1;
        const disable = nextCount >= 3;
        const lastError =
          f.status ? `http_${f.status}${f.statusText ? `:${f.statusText}` : ''}` : (f.error ? `error:${f.error}` : 'error:unknown');

        const updatePayload: Record<string, any> = {
          itunes_fetch_failure_count: nextCount,
          itunes_fetch_last_failed_at: nowIso,
          itunes_fetch_last_error: lastError,
        };

        if (disable) {
          updatePayload.itunes_fetch_disabled = true;
          updatePayload.itunes_fetch_disabled_at = nowIso;
          // Mark as "done" so the UI doesn't keep showing "indexing" forever.
          updatePayload.itunes_indexed_at = nowIso;
        }

        const { error } = await supabase
          .from('songs')
          .update(updatePayload)
          .eq('id', f.songId);

        if (error) {
          console.error(`❌ Failed to record iTunes fetch failure for song ${f.songId}:`, error);
        } else if (disable) {
          console.log(`⛔️ Disabled iTunes indexing for song ${f.songId} after ${nextCount} failures`);
        }
      }
    } else if (suspiciousBurst && fetchFailures.length > 0) {
      console.log('🧯 Ignoring iTunes fetch failures for this run (probable rate limiting/transient).');
    }

    console.log(`✅ Indexing complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: songsToIndex.length,
        succeeded: successCount,
        failed: failCount,
        failureBurstSuspected: suspiciousBurst,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Error in iTunes indexing:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
