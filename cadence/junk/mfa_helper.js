/* Helper to safely check MFA with timeout */
async function checkMfaRequirements(session) {
    if (!supabase.auth.mfa) return false;

    try {
        console.log("🔒 Checking MFA status...");

        // 1. OPTIMIZATION: Check AAL first (Fast, local check)
        // If user is already AAL2 verified, we don't need to check factors
        let aalResult = null;
        try {
            console.log("  - Checking AAL...");
            // Add timeout to AAL check
            const aalTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("AAL check timed out")), 2000));
            const { data: aal, error: aalError } = await Promise.race([
                supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
                aalTimeout
            ]);

            if (!aalError && aal.currentLevel === 'aal2') {
                console.log("✅ User is already MFA verified (AAL2). Skipping factor check.");
                return false;
            }
            aalResult = aal; // Store result
        } catch (aalErr) {
            console.warn("  - AAL check failed or timed out:", aalErr);
            console.log("⚠️ AAL check timed out. Failing OPEN to prevent lockout.");
            console.log("   (Assuming user does not need MFA or Supabase is unresponsive)");
            // CRITICAL CHANGE: If AAL check times out, we assume network/Supabase is flaky.
            // We Fail Open immediately to let the user in.
            return false;
        }

        // 2. OPTIMIZATION: Check Cache for Non-MFA users (Optimistic)
        // If we confidently know the user has 0 verified factors, skip network call
        const cacheKey = `cadence_mfa_factors_${session.user.id}`;
        const cachedCount = localStorage.getItem(cacheKey);

        if (cachedCount === '0') {
            console.log("⏩ Optimistic MFA check: Cache says 0 factors. Allowing access while verifying in background.");

            // Verification in background to catch any security changes
            checkMfaInBackground(session, cacheKey);

            return false; // Allow access immediately
        }

        // 3. Network Check (Slower, fallback)
        console.log("  - Verification required (no cache or MFA potentially active). Verifying...");
        return await verifyMfaAndCache(session, cacheKey);

    } catch (err) {
        console.warn("⚠️ MFA Check skipped/failed (Fail Open):", err);
        return false; // Fail open
    }
}

// Background verification for optimistic checks
function checkMfaInBackground(session, cacheKey) {
    console.log("🔄 Starting background MFA check...");
    verifyMfaAndCache(session, cacheKey).then(isRequired => {
        if (isRequired) {
            console.warn("🔒 Background MFA check found requirement! Locking UI.");
            // If we optimistically let them in but they actually need MFA, lock them out now
            if (!authGate || authGate.classList.contains("hidden")) {
                showAuthGate();
                setAuthMessage("Security check failed. Two-factor authentication required.", false);
                openMfaChallengeModal({
                    onSuccess: () => {
                        // Re-load app logic
                        loadDataAndShowApp(session);
                    }
                });
            }
        } else {
            console.log("✅ Background MFA check passed (consistency confirmed).");
        }
    }).catch(err => {
        console.error("Background MFA check error:", err);
    });
}

// Core verification logic with caching
async function verifyMfaAndCache(session, cacheKey) {
    console.log("  - verifyMfaAndCache called");
    try {
        // Use a simple race with a manually created promise for timeout
        const timeoutMs = 4000;
        const result = await new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error("MFA listFactors timed out"));
            }, timeoutMs);

            try {
                const response = await supabase.auth.mfa.listFactors();
                clearTimeout(timer);
                resolve(response);
            } catch (innerErr) {
                clearTimeout(timer);
                reject(innerErr);
            }
        });

        const { data: factorsData, error: factorsError } = result;

        if (factorsError) throw factorsError;

        // Count verified TOTP factors
        const totpFactors = factorsData?.all?.filter(f => f.factor_type === 'totp' && f.status === 'verified') || [];
        console.log(`  - Factors found: ${totpFactors.length}`);

        // Update cache
        localStorage.setItem(cacheKey, totpFactors.length.toString());

        if (totpFactors.length > 0) {
            // Re-check AAL to be sure
            const { data: aalCheck } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (aalCheck && aalCheck.currentLevel !== 'aal2') {
                console.log("  - MFA required (Factors exist, AAL < 2)");
                return true; // MFA REQUIRED
            }
        }

        console.log("  - MFA not required");
        return false;
    } catch (e) {
        console.warn("  - Error/Timeout in verifyMfaAndCache:", e);
        // Fail open on error
        return false;
    }
}
