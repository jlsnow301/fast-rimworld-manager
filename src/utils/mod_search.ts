import { normalizedPackageId } from './mods';
import type { InstalledMod, VisibleMod } from './types';

type ModSearchDetails = Pick<InstalledMod, 'name'>;
type ModSearchIndex = ReadonlyMap<string, ModSearchDetails>;

export function filterVisibleMods(
	packageIds: readonly string[],
	modDetailsByPackageId: ModSearchIndex,
	query: string,
): VisibleMod[] {
	const normalizedQuery = query.trim().toLowerCase();
	const visibleMods: VisibleMod[] = [];

	for (const [index, packageId] of packageIds.entries()) {
		if (normalizedQuery.length === 0) {
			visibleMods.push({ packageId, index });
			continue;
		}

		const modName = modDetailsByPackageId.get(
			normalizedPackageId(packageId),
		)?.name;
		const matchesPackageId = packageId.toLowerCase().includes(normalizedQuery);
		const matchesModName = modName?.toLowerCase().includes(normalizedQuery) ??
			false;
		if (matchesPackageId || matchesModName) {
			visibleMods.push({ packageId, index });
		}
	}

	return visibleMods;
}
