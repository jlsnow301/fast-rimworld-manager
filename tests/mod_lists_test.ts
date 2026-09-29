import { moveModBetweenLists } from '@/utils/mod_lists.ts';

Deno.test('deactivating removes a mod from active and appends it to inactive', () => {
	const result = moveModBetweenLists(
		['Core', 'Author.First', 'Author.Last'],
		['Author.Other'],
		1,
		'active',
	);
	const expected = {
		active: ['Core', 'Author.Last'],
		inactive: ['Author.Other', 'Author.First'],
		packageId: 'Author.First',
	};

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${
				JSON.stringify(result)
			}`,
		);
	}
});

Deno.test('activating removes a mod from inactive and appends it to active', () => {
	const result = moveModBetweenLists(
		['Core'],
		['Author.First', 'Author.Last'],
		0,
		'inactive',
	);
	const expected = {
		active: ['Core', 'Author.First'],
		inactive: ['Author.Last'],
		packageId: 'Author.First',
	};

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${
				JSON.stringify(result)
			}`,
		);
	}
});

Deno.test('invalid transfer indices leave both lists unchanged', () => {
	const active = ['Core'];
	const inactive = ['Author.Mod'];

	if (moveModBetweenLists(active, inactive, -1, 'active') !== null) {
		throw new Error('Negative active index should not move a mod.');
	}
	if (moveModBetweenLists(active, inactive, 1, 'inactive') !== null) {
		throw new Error('Out-of-range inactive index should not move a mod.');
	}
	if (
		JSON.stringify(active) !== '["Core"]' ||
		JSON.stringify(inactive) !== '["Author.Mod"]'
	) {
		throw new Error('Invalid transfers mutated the input lists.');
	}
});

Deno.test('RimWorld Core stays active while DLC can be deactivated', () => {
	const active = ['Ludeon.RimWorld', 'Ludeon.RimWorld.Royalty'];
	const inactive = ['Ludeon.RimWorld.Biotech'];

	if (moveModBetweenLists(active, inactive, 0, 'active') !== null) {
		throw new Error('RimWorld Core must not move to the inactive list.');
	}

	const result = moveModBetweenLists(active, inactive, 1, 'active');
	const expected = {
		active: ['Ludeon.RimWorld'],
		inactive: ['Ludeon.RimWorld.Biotech', 'Ludeon.RimWorld.Royalty'],
		packageId: 'Ludeon.RimWorld.Royalty',
	};
	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${
				JSON.stringify(result)
			}`,
		);
	}
});
