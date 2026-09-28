import { normalizedPackageId } from './mods';
import type {
	InstalledMod,
	ModHighlightState,
	ModLoadOrderViolation,
} from './types';

export function createActiveModHighlights(
	activeMods: string[],
	modDetailsByPackageId: ReadonlyMap<string, InstalledMod>,
) {
	const activeIndexes = new Map<string, number>();
	for (const [index, packageId] of activeMods.entries()) {
		const normalizedId = normalizedPackageId(packageId);
		if (!activeIndexes.has(normalizedId)) {
			activeIndexes.set(normalizedId, index);
		}
	}

	const highlights = new Map<string, ModHighlightState>();
	for (const [packageId, index] of activeIndexes) {
		const mod = modDetailsByPackageId.get(packageId);
		if (!mod) continue;

		const missingDependencies = mod.dependencies.filter((dependency) =>
			!activeIndexes.has(normalizedPackageId(dependency.packageId)) &&
			!dependency.alternativePackageIds.some((packageId) =>
				activeIndexes.has(normalizedPackageId(packageId))
			)
		);
		const loadOrderViolations: ModLoadOrderViolation[] = [];

		for (const targetPackageId of mod.loadAfter) {
			const targetIndex = activeIndexes.get(
				normalizedPackageId(targetPackageId),
			);
			if (targetIndex !== undefined && index <= targetIndex) {
				loadOrderViolations.push({
					relation: 'after',
					packageId: targetPackageId,
				});
			}
		}

		for (const targetPackageId of mod.loadBefore) {
			const targetIndex = activeIndexes.get(
				normalizedPackageId(targetPackageId),
			);
			if (targetIndex !== undefined && index >= targetIndex) {
				loadOrderViolations.push({
					relation: 'before',
					packageId: targetPackageId,
				});
			}
		}

		if (missingDependencies.length || loadOrderViolations.length) {
			highlights.set(packageId, {
				missingDependencies,
				loadOrderViolations,
			});
		}
	}

	return highlights;
}
