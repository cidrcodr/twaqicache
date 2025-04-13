export default {

	async fetch(request, env, ctx) {
		const cacheKey = "latest_data";
		const apiKey = env.AQI_API_KEY;

		// Try to fetch the cached data from KV
		const cachedData = await env.TAIWAN_AQI_CACHE.get(cacheKey, { type: "json" });

		// Get the current time
		const currentTime = Date.now();

		// Check if cached data exists and if it's less than 2 minutes old
		if (cachedData && currentTime - cachedData.timestamp < 120000) {
			return response(cachedData);
		}

		// If cached data is missing or too old, fetch fresh data
		const freshData = await fetchFreshData(apiKey);

		// Update KV with the new fresh data and current timestamp
		const newCacheData = {
			timestamp: currentTime,
			data: freshData,
		};
		await env.TAIWAN_AQI_CACHE.put(cacheKey, JSON.stringify(newCacheData));
		return response(newCacheData);
	}
};

function response(cachedData) {
	const data = {
		__meta: {
			cache_timestamp_ms: cachedData.timestamp,
			cache_timestamp_iso: new Date(cachedData.timestamp).toISOString()
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

// Fetch fresh data at the source
async function fetchFreshData(apiKey) {
	if (!apiKey) {
		throw Error("Missing AQI API key")
	}
	const apiUrl = `https://data.moenv.gov.tw/api/v2/aqx_p_432?language=en&offset=0&limit=100&api_key=${apiKey}`;

	const response = await fetch(apiUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch fresh data: ${response.statusText}`);
	}

	return await response.json();
}
