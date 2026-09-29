import type { OutdatedWorkshopMod } from './types';

export function allWorkshopUpdateIds(
	mods: readonly OutdatedWorkshopMod[],
): string[] {
	return mods.map((mod) => mod.publishedFileId);
}

export function toggleWorkshopUpdateSelection(
	selectedIds: readonly string[],
	publishedFileId: string,
	checked: boolean,
): string[] {
	if (checked) {
		return selectedIds.includes(publishedFileId)
			? [...selectedIds]
			: [...selectedIds, publishedFileId];
	}
	return selectedIds.filter((id) => id !== publishedFileId);
}

export function getSelectedWorkshopMods(
	mods: readonly OutdatedWorkshopMod[],
	selectedIds: readonly string[],
): OutdatedWorkshopMod[] {
	const selected = new Set(selectedIds);
	return mods.filter((mod) => selected.has(mod.publishedFileId));
}
