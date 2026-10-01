import { normalizedPackageId } from '@/utils/mods';
import type { InstalledMod, VisibleMod } from '@/utils/types';

type ModSearchDetails = Pick<InstalledMod, 'name'>;
type ModSearchIndex = ReadonlyMap<string, ModSearchDetails>;

export function filterVisibleMods(
	packageIds: readonly string[],
	modDetailsByPackageId: ModSearchIndex,
	query: string,
	dimNonMatchingMods = false,
): VisibleMod[] {
	const normalizedQuery = query.trim().toLowerCase();
	const visibleMods: VisibleMod[] = [];

	for (const [index, packageId] of packageIds.entries()) {
		if (normalizedQuery.length === 0) {
			visibleMods.push({ packageId, index, isMatch: true });
			continue;
		}

		const modName = modDetailsByPackageId.get(
			normalizedPackageId(packageId),
		)?.name;
		if (modName === undefined) continue;

		const matchesPackageId = packageId.toLowerCase().includes(
			normalizedQuery,
		);
		const matchesModName = modName.toLowerCase().includes(
			normalizedQuery,
		);
		const isMatch = matchesPackageId || matchesModName;
		if (isMatch || dimNonMatchingMods) {
			visibleMods.push({ packageId, index, isMatch });
		}
	}

	return visibleMods;
}
