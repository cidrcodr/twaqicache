let pendingRefreshPromise = null; // Global in the worker

export default {

	async fetch(request, env, ctx) {
		const cacheKey = "latest_data";
		const apiKey = env.AQI_API_KEY;

		if (!apiKey) {
			throw Error("Missing AQI API key")
		}

		// Get cached data from KV
		const cachedData = await env.TAIWAN_AQI_CACHE.get(cacheKey, { type: "json" });
		const currentTime = Date.now();
		if (cachedData) {
			const cachedDataAge = currentTime - cachedData.timestamp
			const isFresh = cachedDataAge < 120000; // 2 minutes freshness
			if (!isFresh) {
			  	maybeRefreshInBackground(ctx, env, cacheKey, apiKey);
			}
			// Serve the cached data regardless of freshness.
			// Provide hint to app so it can reload after 10s if it got stale data.
			return response(cachedData, isFresh ? "recent" : "stale");
		} else {
			// No cached data at all, must refresh now
			const freshData = await refresh(env, cacheKey, apiKey);
			return response(freshData, "fresh");
		}
	}
};

function response(cachedData, freshness) {
	const data = {
		__meta: {
			cache_timestamp_ms: cachedData.timestamp,
			cache_timestamp_iso: new Date(cachedData.timestamp).toISOString(),
			freshness, // stale, recent, fresh
		},
		...cachedData.data,
	}
	return new Response(JSON.stringify(data), {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=60", // cache for up to 1 minute
		},
	});
}

function maybeRefreshInBackground(ctx, env, cacheKey, apiKey) {
	// Start refresh if not already in progress
	if (!pendingRefreshPromise) {
		const refreshPromise = refresh(env, cacheKey, apiKey).finally(() => {
			pendingRefreshPromise = null;
		});
		pendingRefreshPromise = refreshPromise;
		ctx.waitUntil(refreshPromise);
	}
}
  
async function refresh(env, cacheKey, apiKey) {
	const freshData = await fetchFreshData(apiKey);
	const newCacheData = {
	  timestamp: Date.now(),
	  data: freshData,
	};
	await env.TAIWAN_AQI_CACHE.put(cacheKey, JSON.stringify(newCacheData));
	return newCacheData;
}

// Fetch fresh data at the source
async function fetchFreshData(apiKey) {
	const apiUrl = `https://data.moenv.gov.tw/api/v2/aqx_p_432?language=en&offset=0&limit=100&api_key=${apiKey}`;
	const response = await fetch(apiUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch fresh data: ${response.statusText}`);
	}
	return await response.json();
}
