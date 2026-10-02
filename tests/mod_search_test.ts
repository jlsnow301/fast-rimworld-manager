import { filterVisibleMods } from '@/utils/mod_search.ts';
import type { ModHighlightState, VisibleMod } from '@/utils/types.ts';

const packageIds = [
	'Warnings.Mod',
	'Errors.Mod',
	'Both.Mod',
	'Clean.Mod',
	'Missing.Mod',
];
const modDetails = new Map([
	['warnings.mod', { name: 'Warnings Mod' }],
	['errors.mod', { name: 'Errors Mod' }],
	['both.mod', { name: 'Both Mod' }],
	['clean.mod', { name: 'Clean Mod' }],
]);
const diagnosticsByPackageId = new Map<string, ModHighlightState>([
	['warnings.mod', {
		errors: [],
		warnings: [{
			code: 'version-mismatch',
			severity: 'warning',
			title: 'Version mismatch',
			details: [],
		}],
	}],
	['errors.mod', {
		errors: [{
			code: 'missing-dependency',
			severity: 'error',
			title: 'Missing dependencies',
			details: [],
		}],
		warnings: [],
	}],
	['both.mod', {
		errors: [{
			code: 'missing-dependency',
			severity: 'error',
			title: 'Missing dependencies',
			details: [],
		}],
		warnings: [{
			code: 'version-mismatch',
			severity: 'warning',
			title: 'Version mismatch',
			details: [],
		}],
	}],
]);

function assertVisibleMods(actual: VisibleMod[], expected: VisibleMod[]) {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${
				JSON.stringify(actual)
			}`,
		);
	}
}

Deno.test('search matches package IDs case-insensitively and keeps source indices', () => {
	const result = filterVisibleMods(packageIds, modDetails, 'ERRORS.MOD');
	assertVisibleMods(result, [
		{ packageId: 'Errors.Mod', index: 1, isMatch: true },
	]);
});

Deno.test('search matches installed mod display names', () => {
	const result = filterVisibleMods(packageIds, modDetails, 'warnings mod');
	assertVisibleMods(result, [
		{ packageId: 'Warnings.Mod', index: 0, isMatch: true },
	]);
});

Deno.test('warning filter includes only warning and combined-severity mods', () => {
	const result = filterVisibleMods(packageIds, modDetails, '', {
		filterWarnings: true,
		diagnosticsByPackageId,
	});
	assertVisibleMods(result, [
		{ packageId: 'Warnings.Mod', index: 0, isMatch: true },
		{ packageId: 'Both.Mod', index: 2, isMatch: true },
	]);
});

Deno.test('error filter includes only error and combined-severity mods', () => {
	const result = filterVisibleMods(packageIds, modDetails, '', {
		filterErrors: true,
		diagnosticsByPackageId,
	});
	assertVisibleMods(result, [
		{ packageId: 'Errors.Mod', index: 1, isMatch: true },
		{ packageId: 'Both.Mod', index: 2, isMatch: true },
	]);
});

Deno.test('warning and error filters use OR semantics', () => {
	const result = filterVisibleMods(packageIds, modDetails, '', {
		filterWarnings: true,
		filterErrors: true,
		diagnosticsByPackageId,
	});
	assertVisibleMods(result, [
		{ packageId: 'Warnings.Mod', index: 0, isMatch: true },
		{ packageId: 'Errors.Mod', index: 1, isMatch: true },
		{ packageId: 'Both.Mod', index: 2, isMatch: true },
	]);
});

Deno.test('no severity filters preserve every row with a blank search', () => {
	const result = filterVisibleMods(packageIds, modDetails, '', {
		diagnosticsByPackageId,
	});
	assertVisibleMods(
		result,
		packageIds.map((packageId, index) => ({
			packageId,
			index,
			isMatch: true,
		})),
	);
});

Deno.test('search and severity filters combine as an intersection', () => {
	const result = filterVisibleMods(packageIds, modDetails, 'both', {
		filterWarnings: true,
		filterErrors: true,
		diagnosticsByPackageId,
	});
	assertVisibleMods(result, [
		{ packageId: 'Both.Mod', index: 2, isMatch: true },
	]);
});

Deno.test('dim mode retains and dims installed rows outside search and severity filters', () => {
	const result = filterVisibleMods(packageIds, modDetails, 'both', {
		dimNonMatchingMods: true,
		filterWarnings: true,
		filterErrors: true,
		diagnosticsByPackageId,
	});
	assertVisibleMods(result, [
		{ packageId: 'Warnings.Mod', index: 0, isMatch: false },
		{ packageId: 'Errors.Mod', index: 1, isMatch: false },
		{ packageId: 'Both.Mod', index: 2, isMatch: true },
		{ packageId: 'Clean.Mod', index: 3, isMatch: false },
	]);
});

Deno.test('dim-off mode hides rows that do not match search and active filters', () => {
	const result = filterVisibleMods(packageIds, modDetails, 'both', {
		filterWarnings: true,
		filterErrors: true,
		diagnosticsByPackageId,
	});
	assertVisibleMods(result, [
		{ packageId: 'Both.Mod', index: 2, isMatch: true },
	]);
});

Deno.test('search excludes missing IDs while dim mode retains installed nonmatches', () => {
	const result = filterVisibleMods(packageIds, modDetails, 'missing', {
		dimNonMatchingMods: true,
	});
	assertVisibleMods(result, [
		{ packageId: 'Warnings.Mod', index: 0, isMatch: false },
		{ packageId: 'Errors.Mod', index: 1, isMatch: false },
		{ packageId: 'Both.Mod', index: 2, isMatch: false },
		{ packageId: 'Clean.Mod', index: 3, isMatch: false },
	]);
});
