async function getCountdownData(id) {
    window.CountdownDataID = id;
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

let obtaineddata = false;

// Test the function (only run once)
    (async function GetDataSource() {
        if (!obtaineddata) {
            if(parameter('id')){
                const sourceCountdowndata = await getCountdownData(parameter('id'));
                if (sourceCountdowndata) {
                    window.CountdownDataSource = sourceCountdowndata;
                    window.CountdownDataSourceOrigin = "db";
                    obtaineddata = true;
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
                        window.CountdownDataID = id;
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

            const script = document.createElement("script");
            script.src = "betaapp.js";
            script.onload = function() {
                // Dispatch the event after betaapp.js has loaded and set up its event listener
                document.dispatchEvent(new Event("data-ready"));
            };
            document.body.appendChild(script);
        }
    })();