import { filterVisibleMods } from '@/utils/mod_search.ts';

Deno.test('search matches package IDs case-insensitively and keeps source indices', () => {
	const packageIds = ['Core', 'Author.Mod', 'Author.Other'];
	const modDetails = new Map([
		['core', { name: 'Core' }],
		['author.mod', { name: 'Display Name' }],
		['author.other', { name: 'Other Display Name' }],
	]);

	const result = filterVisibleMods(packageIds, modDetails, 'AUTHOR.MOD');
	const expected = [
		{ packageId: 'Author.Mod', index: 1, isMatch: true },
	];

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${
				JSON.stringify(result)
			}`,
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
	const expected = [
		{ packageId: 'Author.Mod', index: 1, isMatch: true },
	];

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${
				JSON.stringify(result)
			}`,
		);
	}
});

Deno.test('dim mode retains installed nonmatches but excludes missing IDs', () => {
	const packageIds = ['Author.Match', 'Author.Other', 'Missing.Match'];
	const modDetails = new Map([
		['author.match', { name: 'Matching Mod' }],
		['author.other', { name: 'Other Mod' }],
	]);

	const result = filterVisibleMods(
		packageIds,
		modDetails,
		'match',
		true,
	);
	const expected = [
		{ packageId: 'Author.Match', index: 0, isMatch: true },
		{ packageId: 'Author.Other', index: 1, isMatch: false },
	];

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${
				JSON.stringify(result)
			}`,
		);
	}
});

Deno.test('blank queries restore all IDs in their original order', () => {
	const packageIds = ['Core', 'Author.Mod'];
	const modDetails = new Map([['core', { name: 'Core' }]]);

	const result = filterVisibleMods(packageIds, modDetails, '  ', true);
	const expected = [
		{ packageId: 'Core', index: 0, isMatch: true },
		{ packageId: 'Author.Mod', index: 1, isMatch: true },
	];

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${
				JSON.stringify(result)
			}`,
		);
	}
});
