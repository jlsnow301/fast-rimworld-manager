import {
	allWorkshopUpdateIds,
	getSelectedWorkshopMods,
	toggleWorkshopUpdateSelection,
} from '@/utils/workshop_update_selection.ts';
import { steamWorkshopDownloadUrls } from '@/utils/workshop_update_urls.ts';
import type { OutdatedWorkshopMod } from '@/utils/types.ts';

function outdatedMod(publishedFileId: string): OutdatedWorkshopMod {
	return {
		name: `Mod ${publishedFileId}`,
		packageId: `sample.mod${publishedFileId}`,
		publishedFileId,
		installedTimeUpdated: 100,
		steamTimeUpdated: 200,
	};
}

Deno.test('all outdated Workshop mods are selected by default', () => {
	const ids = allWorkshopUpdateIds([
		outdatedMod('123'),
		outdatedMod('456'),
	]);
	if (JSON.stringify(ids) !== JSON.stringify(['123', '456'])) {
		throw new Error(`Unexpected default selection: ${JSON.stringify(ids)}`);
	}
});

Deno.test('Workshop update selection toggles ids without mutating its input', () => {
	const selected = ['123', '456'];
	const unchecked = toggleWorkshopUpdateSelection(selected, '123', false);
	const rechecked = toggleWorkshopUpdateSelection(unchecked, '123', true);
	if (
		JSON.stringify(selected) !== JSON.stringify(['123', '456']) ||
		JSON.stringify(unchecked) !== JSON.stringify(['456']) ||
		JSON.stringify(rechecked) !== JSON.stringify(['456', '123'])
	) {
		throw new Error(
			'Toggling selections should preserve independent list state.',
		);
	}
});

Deno.test('dispatch payload contains only selected outdated Workshop mods', () => {
	const mods = [outdatedMod('123'), outdatedMod('456'), outdatedMod('789')];
	const selectedMods = getSelectedWorkshopMods(mods, ['789', '123']);
	const urls = steamWorkshopDownloadUrls(selectedMods);
	const expected = [
		'steam://workshop_download_item/294100/123',
		'steam://workshop_download_item/294100/789',
	];
	if (JSON.stringify(urls) !== JSON.stringify(expected)) {
		throw new Error(
			`Unexpected selected dispatch URLs: ${JSON.stringify(urls)}`,
		);
	}
});

Deno.test('an empty Workshop selection produces no dispatch payload', () => {
	const selectedMods = getSelectedWorkshopMods(
		[outdatedMod('123'), outdatedMod('456')],
		[],
	);
	if (steamWorkshopDownloadUrls(selectedMods).length !== 0) {
		throw new Error(
			'An empty selection must not create Steam update requests.',
		);
	}
});
