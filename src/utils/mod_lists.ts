import { normalizedPackageId } from './mods';
export type ModListTransfer = {
	active: string[];
	inactive: string[];
	packageId: string;
};

export function moveModBetweenLists(
	active: string[],
	inactive: string[],
	index: number,
	source: 'active' | 'inactive',
): ModListTransfer | null {
	const sourceMods = source === 'active' ? active : inactive;
	const packageId = sourceMods[index];
	if (packageId === undefined) return null;
	if (
		source === 'active' &&
		normalizedPackageId(packageId) === 'ludeon.rimworld'
	) return null;

	if (source === 'active') {
		return {
			active: active.filter((_, currentIndex) => currentIndex !== index),
			inactive: [...inactive, packageId],
			packageId,
		};
	}

	return {
		active: [...active, packageId],
		inactive: inactive.filter((_, currentIndex) => currentIndex !== index),
		packageId,
	};
}
