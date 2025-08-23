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

// Global flag to prevent multiple executions
let obtaineddata = false;
let initCompleted = false;

// Test the function (only run once)
(async function GetDataSource() {
    // Global protection against duplicate data-ready events
    if (window.dataReadyProtected) {
        console.log('init.js: Data-ready protection already active, skipping execution');
        initCompleted = true;
        return;
    }
    window.dataReadyProtected = true;
    // Prevent multiple executions
    if (obtaineddata || initCompleted) {
        return;
    }
    
    try {
        if(parameter('id')){
            const sourceCountdowndata = await getCountdownData(parameter('id'));
            if (sourceCountdowndata) {
                window.CountdownDataSource = sourceCountdowndata;
                window.CountdownDataSourceOrigin = "db";
                obtaineddata = true;
                
                // Also fetch user-related data for this countdown
                const userRelatedData = await getUserRelatedData(parameter('id'));
                if (userRelatedData) {
                    window.CountdownUserData = userRelatedData;
                }
            }
        } else if(parameter('date') || parameter('schedule')){
            window.CountdownDataSource = window.location.search;
            window.CountdownDataSourceOrigin = "url";
            obtaineddata = true;
        }
        else{
            //need to init a new countdown, as there are no parameters
            window.CountdownDataSource = window.location.search;
            // If the user is logged in, set CountdownDataSourceOrigin to "db", else "url"
            if (window.supabaseClient && window.supabaseClient.auth) {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                if (session && session.user) {
                    window.CountdownDataSourceOrigin = "db";
                    obtaineddata = true;

                } else {
                    window.CountdownDataSourceOrigin = "testing";
                    obtaineddata = true;
                }
            } else {
                window.CountdownDataSourceOrigin = "testing";
                obtaineddata = true;
            }
        }
        
        if(obtaineddata){
            // Mark as completed to prevent re-execution
            initCompleted = true;
            
            const script = document.createElement("script");
            script.src = "betaapp.js";
            script.onload = function() {
                // Dispatch the event only once after betaapp.js has loaded
                if (!window.dataReadyDispatched && !window.dataReadyEventFired) {
                    window.dataReadyDispatched = true;
                    window.dataReadyEventFired = true;
                    
                    // Use a custom event with more control
                    const dataReadyEvent = new CustomEvent("data-ready", {
                        detail: { 
                            timestamp: Date.now(),
                            source: 'init.js'
                        }
                    });
                    
                    document.dispatchEvent(dataReadyEvent);
                    
                    // Clean up init.js completely
                    cleanupInitJS();
                }
            };
            document.body.appendChild(script);
        }
    } catch (error) {
        console.error('Error in GetDataSource:', error);
        // Mark as completed even on error to prevent retries
        initCompleted = true;
    }
})();

// Function to completely clean up init.js
function cleanupInitJS() {
    try {
        // Remove all event listeners that might have been added
        document.removeEventListener("data-ready", GetDataSource);
        
        // Clear any timers or intervals that might be running
        if (window.initTimers) {
            window.initTimers.forEach(timerId => {
                clearTimeout(timerId);
                clearInterval(timerId);
            });
            delete window.initTimers;
        }
        
        // Remove the init.js script tag from the DOM
        const scripts = document.querySelectorAll('script[src*="init.js"]');
        scripts.forEach(script => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        });
        
        // Clear any global variables or functions that might cause issues
        delete window.GetDataSource;
        delete window.getCountdownData;
        delete window.getUserRelatedData;
        delete window.cleanupInitJS;
        
        // Mark the cleanup as complete
        window.initJSCleanedUp = true;
        
        console.log('init.js has been completely cleaned up');
    } catch (error) {
        console.error('Error during init.js cleanup:', error);
    }
}
