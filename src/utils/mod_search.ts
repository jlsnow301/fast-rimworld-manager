import { normalizedPackageId } from '@/utils/mods';
import type {
	InstalledMod,
	ModHighlightState,
	VisibleMod,
} from '@/utils/types';

type ModSearchDetails = Pick<InstalledMod, 'name'>;
type ModSearchIndex = ReadonlyMap<string, ModSearchDetails>;
type ModSearchOptions = {
	dimNonMatchingMods?: boolean;
	filterWarnings?: boolean;
	filterErrors?: boolean;
	diagnosticsByPackageId?: ReadonlyMap<string, ModHighlightState>;
};

export function filterVisibleMods(
	packageIds: readonly string[],
	modDetailsByPackageId: ModSearchIndex,
	query: string,
	options: ModSearchOptions = {},
): VisibleMod[] {
	const normalizedQuery = query.trim().toLowerCase();
	const visibleMods: VisibleMod[] = [];
	const hasSeverityFilter = options.filterWarnings || options.filterErrors;

	for (const [index, packageId] of packageIds.entries()) {
		const normalizedId = normalizedPackageId(packageId);
		const mod = modDetailsByPackageId.get(normalizedId);
		if (normalizedQuery && !mod) continue;

		const matchesSearch = normalizedQuery.length === 0 ||
			packageId.toLowerCase().includes(normalizedQuery) ||
			mod?.name.toLowerCase().includes(normalizedQuery) === true;
		const diagnostics = options.diagnosticsByPackageId?.get(normalizedId);
		const matchesSeverity = !hasSeverityFilter ||
			(Boolean(options.filterWarnings && diagnostics?.warnings.length) ||
				Boolean(options.filterErrors && diagnostics?.errors.length));
		const isMatch = matchesSearch && matchesSeverity;
		if (isMatch || options.dimNonMatchingMods) {
			visibleMods.push({ packageId, index, isMatch });
		}
	}

	return visibleMods;
}
