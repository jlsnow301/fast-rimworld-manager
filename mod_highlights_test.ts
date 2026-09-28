import { createActiveModHighlights } from './src/utils/mod_highlights.ts';
import type { InstalledMod } from './src/utils/types.ts';

function mod(
	packageId: string,
	updates: Partial<InstalledMod> = {},
): InstalledMod {
	return {
		name: packageId,
		packageId,
		description: '',
		publishedFileId: null,
		loadAfter: [],
		loadBefore: [],
		dependencies: [],
		path: '',
		source: 'local',
		...updates,
	};
}

Deno.test('flags only missing dependencies and active load-order violations', () => {
	const consumer = mod('Author.Consumer', {
		dependencies: [
			{
				packageId: 'Ludeon.RimWorld',
				name: 'RimWorld',
				alternativePackageIds: [],
			},
			{
				packageId: 'Author.Framework',
				name: 'Framework',
				alternativePackageIds: [],
			},
			{
				packageId: 'Author.Missing',
				name: 'Missing Mod',
				alternativePackageIds: [],
			},
		],
		loadAfter: ['Author.Framework', 'Author.NotActive'],
		loadBefore: ['Ludeon.RimWorld'],
	});
	const details = new Map([
		['author.consumer', consumer],
		['ludeon.rimworld', mod('Ludeon.RimWorld')],
		['author.framework', mod('Author.Framework')],
	]);

	const highlights = createActiveModHighlights(
		['Ludeon.RimWorld', 'Author.Consumer_steam', 'Author.Framework'],
		details,
	);

	if (
		JSON.stringify(highlights.get('author.consumer')) !==
			JSON.stringify({
				missingDependencies: [
					{
						packageId: 'Author.Missing',
						name: 'Missing Mod',
						alternativePackageIds: [],
					},
				],
				loadOrderViolations: [
					{ relation: 'after', packageId: 'Author.Framework' },
					{ relation: 'before', packageId: 'Ludeon.RimWorld' },
				],
			})
	) {
		throw new Error(
			`Unexpected highlights: ${JSON.stringify([...highlights])}`,
		);
	}
	if (highlights.has('author.framework')) {
		throw new Error(
			'A framework with no missing dependencies should stay unhighlighted.',
		);
	}
});

Deno.test('keeps satisfied dependencies and correctly ordered rules unhighlighted', () => {
	const modList = mod('Author.Consumer', {
		dependencies: [
			{
				packageId: 'Ludeon.RimWorld',
				name: 'RimWorld',
				alternativePackageIds: [],
			},
			{
				packageId: 'Author.Framework',
				name: 'Framework',
				alternativePackageIds: [],
			},
			{
				packageId: 'Author.Outdated',
				name: 'Outdated Dependency',
				alternativePackageIds: ['Author.Alternative'],
			},
		],
		loadAfter: ['Author.Framework'],
		loadBefore: ['Author.Patch'],
	});
	const details = new Map([
		['author.consumer', modList],
		['author.framework', mod('Author.Framework')],
	]);

	const highlights = createActiveModHighlights(
		[
			'Ludeon.RimWorld',
			'Author.Framework',
			'Author.Consumer',
			'Author.Patch',
			'Author.Alternative',
		],
		details,
	);

	if (highlights.size !== 0) {
		throw new Error(
			`Expected no warnings for a satisfied, ordered list: ${
				JSON.stringify([...highlights])
			}`,
		);
	}
});
