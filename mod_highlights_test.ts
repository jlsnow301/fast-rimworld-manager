import { createActiveModDiagnostics } from './src/utils/mod_highlights.ts';
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
		incompatibleWith: [],
		supportedVersions: [],
		dependencies: [],
		path: '',
		source: 'local',
		...updates,
	};
}

Deno.test('reports active config errors and warnings by affected mod', () => {
	const consumer = mod('Author.Consumer', {
		dependencies: [
			{
				packageId: 'Author.Missing',
				name: 'Missing Framework',
				alternativePackageIds: [],
			},
		],
		loadAfter: ['Author.Framework'],
		incompatibleWith: ['Author.Bad'],
		supportedVersions: ['1.5'],
	});
	const details = new Map([
		['ludeon.rimworld', mod('Ludeon.RimWorld')],
		['author.consumer', consumer],
		['author.framework', mod('Author.Framework')],
		['author.bad', mod('Author.Bad')],
	]);
	const diagnostics = createActiveModDiagnostics(
		[
			'Ludeon.RimWorld',
			'Author.Consumer',
			'Author.Framework',
			'Author.Bad',
			'Author.Bad_steam',
			'Unknown.Mod',
		],
		details,
		'1.6.3682',
	);

	const consumerIssues = diagnostics.byPackageId.get('author.consumer');
	const duplicateIssues = diagnostics.byPackageId.get('author.bad');
	const unknownIssues = diagnostics.byPackageId.get('unknown.mod');
	if (
		JSON.stringify(consumerIssues?.errors.map((issue) => issue.code).sort()) !==
			JSON.stringify(['incompatibility', 'missing-dependency'])
	) {
		throw new Error(
			`Unexpected consumer errors: ${JSON.stringify(consumerIssues)}`,
		);
	}
	if (
		JSON.stringify(
			consumerIssues?.warnings.map((issue) => issue.code).sort(),
		) !==
			JSON.stringify(['load-order', 'version-mismatch'])
	) {
		throw new Error(
			`Unexpected consumer warnings: ${JSON.stringify(consumerIssues)}`,
		);
	}
	if (
		JSON.stringify(
			duplicateIssues?.errors.map((issue) => issue.code).sort(),
		) !==
			JSON.stringify(['duplicate-mod', 'incompatibility'])
	) {
		throw new Error(
			`Unexpected duplicate mod errors: ${JSON.stringify(duplicateIssues)}`,
		);
	}
	if (unknownIssues?.errors[0]?.code !== 'missing-mod') {
		throw new Error(
			`Uninstalled active ID was not reported: ${
				JSON.stringify(unknownIssues)
			}`,
		);
	}
	if (diagnostics.errorCount !== 3 || diagnostics.warningCount !== 1) {
		throw new Error(
			`Unexpected summary counts: ${JSON.stringify(diagnostics)}`,
		);
	}
});

Deno.test('accepts alternative dependencies and supported game versions', () => {
	const consumer = mod('Author.Consumer', {
		dependencies: [
			{
				packageId: 'Ludeon.RimWorld',
				name: 'RimWorld',
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
		supportedVersions: ['v1.6.0'],
	});
	const details = new Map([
		['ludeon.rimworld', mod('Ludeon.RimWorld')],
		['author.consumer', consumer],
		['author.framework', mod('Author.Framework')],
		['author.patch', mod('Author.Patch')],
		['author.alternative', mod('Author.Alternative')],
	]);
	const diagnostics = createActiveModDiagnostics(
		[
			'Ludeon.RimWorld',
			'Author.Framework',
			'Author.Consumer',
			'Author.Patch',
			'Author.Alternative',
		],
		details,
		'1.6.3700',
	);

	if (diagnostics.errorCount || diagnostics.warningCount) {
		throw new Error(`Expected a clean list: ${JSON.stringify(diagnostics)}`);
	}
});
