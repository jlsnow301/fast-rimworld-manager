import { filterVisibleMods } from '../src/utils/mod_search.ts';

Deno.test('search matches package IDs case-insensitively and keeps source indices', () => {
	const packageIds = ['Core', 'Author.Mod', 'Author.Other'];
	const modDetails = new Map([
		['core', { name: 'Core' }],
		['author.mod', { name: 'Display Name' }],
		['author.other', { name: 'Other Display Name' }],
	]);

	const result = filterVisibleMods(packageIds, modDetails, 'AUTHOR.MOD');
	const expected = [{ packageId: 'Author.Mod', index: 1 }];

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`,
		);
	}
});

Deno.test('search matches installed mod display names', () => {
	const packageIds = ['Core', 'Author.Mod'];
	const modDetails = new Map([
		['core', { name: 'Core' }],
		['author.mod', { name: 'Great Mod' }],
	]);

	const result = filterVisibleMods(packageIds, modDetails, 'great mod');
	const expected = [{ packageId: 'Author.Mod', index: 1 }];

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`,
		);
	}
});

Deno.test('blank queries show all mods in their original order', () => {
	const packageIds = ['Core', 'Author.Mod'];
	const modDetails = new Map([['core', { name: 'Core' }]]);

	const result = filterVisibleMods(packageIds, modDetails, '  ');
	const expected = [
		{ packageId: 'Core', index: 0 },
		{ packageId: 'Author.Mod', index: 1 },
	];

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`,
		);
	}
});
