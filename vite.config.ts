import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

function webSocketAndApiPlugin(): Plugin {
	return {
		name: 'websocket-api-dev-server',
		configureServer(server) {
			if (!server.httpServer) return;

			import('./src/lib/server/websocket.js').then(({ setupWebSocket }) => {
				setupWebSocket(server.httpServer!);
				console.log('[ws] WebSocket server attached to dev server at /ws');
			});

			import('./src/lib/server/api.js').then(({ handleApiRequest, getOrCreateApiKey }) => {
				getOrCreateApiKey();

				server.middlewares.use(async (req, res, next) => {
					if (req.url?.startsWith('/api/')) {
						const handled = await handleApiRequest(req, res);
						if (handled) return;
					}
					next();
				});

				console.log('[api] REST API handler attached at /api/*');
			});
		}
	};
}

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), webSocketAndApiPlugin()],
	server: {
		hmr: {
			port: 24678
		}
	}
});
