import type { InstalledMod, PathField, PathSettings } from '@/utils/types';

export const EMPTY_PATH_SETTINGS: PathSettings = {
	gamePath: '',
	configPath: '',
	localModsPath: '',
	workshopPath: '',
};

export const PATH_FIELDS: PathField[] = [
	{ key: 'gamePath', label: 'RimWorld game folder' },
	{ key: 'configPath', label: 'RimWorld config folder' },
	{ key: 'localModsPath', label: 'Local mods folder' },
	{ key: 'workshopPath', label: 'Steam Workshop mods folder' },
];

export function normalizedPackageId(packageId: string) {
	return packageId.toLowerCase().replace(/_steam$/, '');
}

export function getInactivePackageIds(
	installedMods: InstalledMod[],
	activeMods: string[],
) {
	const activeIds = new Set(activeMods.map(normalizedPackageId));
	const seenIds = new Set<string>();
	const inactiveMods: string[] = [];

	for (const mod of installedMods) {
		const packageId = normalizedPackageId(mod.packageId);
		if (!packageId || activeIds.has(packageId) || seenIds.has(packageId)) {
			continue;
		}
		seenIds.add(packageId);
		inactiveMods.push(mod.packageId);
	}

	return inactiveMods;
}
