(function() {
    if(parameter('cardmode')){
        return;
    }
    
    if (window._initJsLoaded) {
        console.log("init.js already loaded, exiting immediately");
        return; // this return is valid, because we're inside a function now
    }
    window._initJsLoaded = true;

    if (window._betaAppAppended) {
        console.log("betaapp.js already loaded, exiting immediately");
        return;
    }
    
    // Additional protection: Check if script already exists in DOM
    const existingScript = document.querySelector('script[src="betaapp.js"]');

    // Also check if the script is already loaded by looking for any script with this src
    const allScripts = document.querySelectorAll('script[src]');
    let scriptAlreadyLoaded = false;

    for (let script of allScripts) {
        if (script.src && script.src.includes('betaapp.js')) {
            scriptAlreadyLoaded = true;
            break;
        }
    }

    if(parameter('cardmode') && !existingScript && !scriptAlreadyLoaded && !window._betaAppAppended){
        window.CountdownDataSource = window.location.search;
        window.CountdownDataSourceOrigin = "url";
        window._obtainedData = true;
        window._initJsLoaded = true;
        const script = document.createElement("script");
        script.src = "betaapp.js";
        script.onload = function() {
            // Dispatch the event after betaapp.js has loaded and set up its event listener
            document.dispatchEvent(new Event("data-ready"));
        };
        document.body.appendChild(script);
        window._betaAppAppended = true; // Mark as appended
        console.log('betaapp.js script appended on card');
        return;
    }


async function getCountdownData(id) {
    window.CountdownDataID = id;
    // Reset gear icon update flag when countdown ID changes
    window.gearIconUpdated = false;
    try {
        const { data, error } = await window.supabaseClient
            .from('countdown')
            .select('data')
            .eq('id', id)
            .single();
        
        if (error) {
            console.error('Error fetching countdown data:', error);
            return null;
        }
        
        if (data && data.data) {
            // Strip surrounding quotes if present
            let queryString = data.data;
            if (queryString.startsWith('"') && queryString.endsWith('"')) {
                queryString = queryString.slice(1, -1);
            }
            return queryString;
        } else {
            console.warn('No data found for ID:', id);
            return null;
        }
    } catch (error) {
        console.error('Error in getCountdownData:', error);
        return null;
    }
}

// New function to fetch all user-related data in one consolidated request
async function getUserRelatedData(id) {
    try {
        // Fetch countdown data including creator, created_at, clonedfrom, and collaborator_ids
        const { data: countdownData, error: countdownError } = await window.supabaseClient
            .from('countdown')
            .select('creator, created_at, clonedfrom, collaborator_ids')
            .eq('id', id)
            .maybeSingle();

        if (countdownError || !countdownData || !countdownData.creator) {
            console.warn('No countdown data or creator found for ID:', id);
            return null;
        }

        // Fetch creator's profile data from public_profiles table
        const { data: userData, error: userError } = await window.supabaseClient
            .from('public_profiles')
            .select('name, avatar_url, official')
            .eq('id', countdownData.creator)
            .maybeSingle();

        if (userError) {
            console.warn('Error fetching user profile data:', userError);
            // Return countdown data even if user profile fetch fails
            return {
                countdown: countdownData,
                user: null
            };
        }

        return {
            countdown: countdownData,
            user: userData
        };
    } catch (error) {
        console.error('Error in getUserRelatedData:', error);
        return null;
    }
}

window._obtainedData = window._obtainedData || false;
window._betaAppAppended = window._betaAppAppended || false;

// Test the function (only run once)
    (async function GetDataSource() {
        if (!window._obtainedData && !window._betaAppAppended) {
            if(parameter('id')){
                const sourceCountdowndata = await getCountdownData(parameter('id'));
                if (sourceCountdowndata) {
                    window.CountdownDataSource = sourceCountdowndata;
                    window.CountdownDataSourceOrigin = "db";
                    window._obtainedData = true;
                    
                    // Also fetch user-related data for this countdown
                    const userRelatedData = await getUserRelatedData(parameter('id'));
                    if (userRelatedData) {
                        window.CountdownUserData = userRelatedData;
                    }
                }
            } else if(parameter('date') || parameter('schedule')){
                window.CountdownDataSource = window.location.search;
                window.CountdownDataSourceOrigin = "url";
                window._obtainedData = true;
            }
            else{
                //need to init a new countdown, as there are no parameters
                window.CountdownDataSource = window.location.search;
                // If the user is logged in, set CountdownDataSourceOrigin to "db", else "url"
                if (window.supabaseClient && window.supabaseClient.auth) {
                    const { data: { session } } = await window.supabaseClient.auth.getSession();
                    if (session && session.user) {
                        window.CountdownDataSourceOrigin = "db";
                        window._obtainedData = true;

                    } else {
                        window.CountdownDataSourceOrigin = "testing";
                        window._obtainedData = true;
                    }
                } else {
                    window.CountdownDataSourceOrigin = "testing";
                    window._obtainedData = true;
                }
            }
            
            if(window._obtainedData && !window._betaAppAppended){
                // Additional protection: Check if script already exists in DOM
                const existingScript = document.querySelector('script[src="betaapp.js"]');
                
                // Also check if the script is already loaded by looking for any script with this src
                const allScripts = document.querySelectorAll('script[src]');
                let scriptAlreadyLoaded = false;
                
                for (let script of allScripts) {
                    if (script.src && script.src.includes('betaapp.js')) {
                        scriptAlreadyLoaded = true;
                        break;
                    }
                }
                
                if (!existingScript && !scriptAlreadyLoaded) {
                    const script = document.createElement("script");
                    script.src = "betaapp.js";
                    script.onload = function() {
                        // Dispatch the event after betaapp.js has loaded and set up its event listener
                        document.dispatchEvent(new Event("data-ready"));
                    };
                    document.body.appendChild(script);
                    window._betaAppAppended = true; // Mark as appended
                    console.log('betaapp.js script appended successfully');
                    return;
                } else {
                    // Script already exists or is loaded, just dispatch the event
                    console.log('betaapp.js script already exists, skipping append');
                    document.dispatchEvent(new Event("data-ready"));
                    window._betaAppAppended = true;
                    return;
                }
            }
        }
    })();
})();

function parameter(name) { //returns the value of the parameter it's sent
    var query = window.location.search.substring(1);
    var parameters = query.split('&');
    for (var i = 0; i < parameters.length; i++) {
        var pair = parameters[i].split('=');
        if (pair[0] == name) {
            return pair[1];
        }
    }
    return null;
}