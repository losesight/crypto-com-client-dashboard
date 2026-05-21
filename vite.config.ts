import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import JavaScriptObfuscator from 'javascript-obfuscator';

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

function isBrowserClientChunk(fileName: string): boolean {
	// Only obfuscate assets shipped to the browser — never SSR / adapter-node output.
	if (fileName.includes('server') || fileName.includes('entries/')) return false;
	return (
		fileName.startsWith('_app/') ||
		fileName.includes('/client/') ||
		fileName.startsWith('client/')
	);
}

function obfuscateClientBundlePlugin(enabled: boolean): Plugin {
	return {
		name: 'obfuscate-client-bundle',
		apply: 'build',
		generateBundle(_, bundle) {
			if (!enabled) return;
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== 'chunk') continue;
				if (!chunk.fileName.endsWith('.js')) continue;
				if (!isBrowserClientChunk(chunk.fileName)) continue;
				chunk.code = JavaScriptObfuscator.obfuscate(chunk.code, {
					compact: true,
					controlFlowFlattening: false,
					deadCodeInjection: false,
					identifierNamesGenerator: 'hexadecimal',
					renameGlobals: false,
					stringArray: true,
					stringArrayRotate: true,
					stringArrayShuffle: true,
					stringArrayThreshold: 0.75,
					unicodeEscapeSequence: false
				}).getObfuscatedCode();
			}
		}
	};
}

export default defineConfig(({ command, isSsrBuild }) => ({
	plugins: [
		tailwindcss(),
		sveltekit(),
		webSocketAndApiPlugin(),
		// isSsrBuild alone is not reliable for SvelteKit's multi-phase build; path filter is the guard.
		obfuscateClientBundlePlugin(command === 'build')
	],
	build: {
		sourcemap: false
	},
	server: {
		hmr: {
			port: 24678
		}
	}
}));
