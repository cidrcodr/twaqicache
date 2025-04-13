import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('TW AQI Cache worker', () => {
	it('responds with AQI data', async () => {
		const request = new Request('http://example.com');
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		const data = await response.json();
		expect(data).toHaveProperty("__meta");
		expect(data).toHaveProperty("fields");
		expect(data).toHaveProperty("records");
	});
});
