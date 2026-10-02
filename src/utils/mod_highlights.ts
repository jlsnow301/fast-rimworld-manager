import { normalizedPackageId } from '@/utils/mods';
import type {
	ActiveModDiagnostics,
	InstalledMod,
	ModHighlightState,
	ModIssueCode,
	ModIssueSeverity,
} from '@/utils/types';

export function createActiveModDiagnostics(
	activeMods: string[],
	modDetailsByPackageId: ReadonlyMap<string, InstalledMod>,
	gameVersion: string,
): ActiveModDiagnostics {
	const activeIndexes = new Map<string, number>();
	const activePackageIds = new Map<string, string>();
	const activeCounts = new Map<string, number>();
	for (const [index, packageId] of activeMods.entries()) {
		const normalizedId = normalizedPackageId(packageId);
		if (!activeIndexes.has(normalizedId)) {
			activeIndexes.set(normalizedId, index);
			activePackageIds.set(normalizedId, packageId);
		}
		activeCounts.set(
			normalizedId,
			(activeCounts.get(normalizedId) ?? 0) + 1,
		);
	}

	const byPackageId = new Map<string, ModHighlightState>();
	function addIssue(
		packageId: string,
		severity: ModIssueSeverity,
		code: ModIssueCode,
		title: string,
		detail: string,
	) {
		const normalizedId = normalizedPackageId(packageId);
		let state = byPackageId.get(normalizedId);
		if (!state) {
			state = { errors: [], warnings: [] };
			byPackageId.set(normalizedId, state);
		}
		const issues = severity === 'error' ? state.errors : state.warnings;
		let issue = issues.find((entry) => entry.code === code);
		if (!issue) {
			issue = { code, severity, title, details: [] };
			issues.push(issue);
		}
		if (detail && !issue.details.includes(detail)) {
			issue.details.push(detail);
		}
	}

	for (const [packageId, occurrenceCount] of activeCounts) {
		if (occurrenceCount > 1) {
			addIssue(
				activePackageIds.get(packageId) ?? packageId,
				'error',
				'duplicate-mod',
				'Duplicate active mod',
				`Appears ${occurrenceCount} times in the active list.`,
			);
		}
	}

	const reportedIncompatibilities = new Set<string>();
	for (const [packageId, index] of activeIndexes) {
		const mod = modDetailsByPackageId.get(packageId);
		if (!mod) {
			addIssue(
				activePackageIds.get(packageId) ?? packageId,
				'error',
				'missing-mod',
				'Mod is not installed',
				activePackageIds.get(packageId) ?? packageId,
			);
			continue;
		}

		const missingDependencies = mod.dependencies.filter((dependency) =>
			!activeIndexes.has(normalizedPackageId(dependency.packageId)) &&
			!dependency.alternativePackageIds.some((alternativePackageId) =>
				activeIndexes.has(normalizedPackageId(alternativePackageId))
			)
		);
		if (missingDependencies.length) {
			addIssue(
				mod.packageId,
				'error',
				'missing-dependency',
				'Missing dependencies',
				missingDependencies.map((dependency) => dependency.name).join(
					', ',
				),
			);
		}

		for (const incompatiblePackageId of mod.incompatibleWith) {
			const incompatibleId = normalizedPackageId(incompatiblePackageId);
			const incompatibleMod = modDetailsByPackageId.get(incompatibleId);
			if (
				!activeIndexes.has(incompatibleId) ||
				incompatibleId === packageId
			) {
				continue;
			}
			const pair = [packageId, incompatibleId].sort().join('\0');
			if (reportedIncompatibilities.has(pair)) continue;
			reportedIncompatibilities.add(pair);

			const incompatibleName = incompatibleMod?.name ??
				activePackageIds.get(incompatibleId) ?? incompatiblePackageId;
			const modName = mod.name || mod.packageId;
			addIssue(
				mod.packageId,
				'error',
				'incompatibility',
				'Incompatible mods',
				incompatibleName,
			);
			addIssue(
				incompatibleMod?.packageId ?? incompatiblePackageId,
				'error',
				'incompatibility',
				'Incompatible mods',
				modName,
			);
		}

		for (const targetPackageId of mod.loadAfter) {
			const targetIndex = activeIndexes.get(
				normalizedPackageId(targetPackageId),
			);
			if (targetIndex !== undefined && index <= targetIndex) {
				addIssue(
					mod.packageId,
					'warning',
					'load-order',
					'Load order violation',
					`Should load after ${targetPackageId}.`,
				);
			}
		}

		for (const targetPackageId of mod.loadBefore) {
			const targetIndex = activeIndexes.get(
				normalizedPackageId(targetPackageId),
			);
			if (targetIndex !== undefined && index >= targetIndex) {
				addIssue(
					mod.packageId,
					'warning',
					'load-order',
					'Load order violation',
					`Should load before ${targetPackageId}.`,
				);
			}
		}

		const supportedVersions = new Set(
			mod.supportedVersions.map(normalizedGameVersion).filter(Boolean),
		);
		const currentVersion = normalizedGameVersion(gameVersion);
		if (
			!mod.versionWarningSilenced &&
			supportedVersions.size &&
			currentVersion &&
			!supportedVersions.has(currentVersion)
		) {
			addIssue(
				mod.packageId,
				'warning',
				'version-mismatch',
				'Game version mismatch',
				`Game ${currentVersion}; supported ${
					[...supportedVersions].join(', ')
				}.`,
			);
		}
	}

	let errorCount = 0;
	let warningCount = 0;
	for (const state of byPackageId.values()) {
		if (state.errors.length) errorCount += 1;
		if (state.warnings.length) warningCount += 1;
	}

	return { byPackageId, errorCount, warningCount };
}

function normalizedGameVersion(version: string) {
	const trimmedVersion = version.trim();
	const unprefixedVersion = trimmedVersion.toLowerCase().startsWith('v')
		? trimmedVersion.slice(1)
		: trimmedVersion;
	const [major, minor] = unprefixedVersion.split('.');
	return major && minor ? `${major}.${minor}` : '';
}
