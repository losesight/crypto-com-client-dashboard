import { handler } from './build/handler.js';
import http from 'node:http';
import { setupWebSocket } from './build/server/lib/server/websocket.js';
import { handleApiRequest, getOrCreateApiKey } from './build/server/lib/server/api.js';

const apiKey = getOrCreateApiKey();

const server = http.createServer(async (req, res) => {
	if (req.url?.startsWith('/api/')) {
		const handled = await handleApiRequest(req, res);
		if (handled) return;
	}

	handler(req, res, () => {
		res.writeHead(404).end();
	});
});

setupWebSocket(server);

const port = process.env.PORT || 3000;
server.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
	console.log(`WebSocket available at ws://localhost:${port}/ws`);
	console.log(`REST API available at http://localhost:${port}/api/*`);
});
