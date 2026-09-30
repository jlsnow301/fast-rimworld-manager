import { createStore } from 'jotai';
import {
	activeModDiagnosticsAtom,
	activeModsAtom,
	activeSearchAtom,
	configuredGameVersionAtom,
	gameVersionAtom,
	inactiveModsAtom,
	inactiveSearchAtom,
	installedGameVersionAtom,
	installedModsAtom,
	isModListDirtyAtom,
	isTestModeAtom,
	savedSnapshotAtom,
	sourceNameAtom,
	toggleTestModeAtom,
	workshopUpdateResultAtom,
} from '@/features/mod-list/atoms.ts';
import { createModListSnapshot } from '@/utils/dirty_state.ts';
import { TEST_MOD_LIST } from '@/utils/test_mod_list.ts';
import type { InstalledMod } from '@/utils/types.ts';

function installedMod(packageId: string): InstalledMod {
	return {
		name: packageId,
		author: null,
		packageId,
		description: '',
		publishedFileId: null,
		loadAfter: [],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: [],
		path: '',
		source: 'local',
		dependencies: [],
	};
}

Deno.test('test mode loads sample mods and diagnostics without dirtying the list', () => {
	const store = createStore();

	store.set(toggleTestModeAtom);

	if (!store.get(isTestModeAtom)) {
		throw new Error('Test mode should become active.');
	}
	if (
		store.get(installedModsAtom).length !==
			TEST_MOD_LIST.installedMods.length
	) {
		throw new Error('Test mode should expose the sample installed mods.');
	}
	if (store.get(activeModsAtom)[3] !== 'sample.vehiclemod') {
		throw new Error('Test mode should load the sample active mod list.');
	}
	if (store.get(activeModsAtom)[1] !== 'ludeon.rimworld.royalty') {
		throw new Error(
			'Test mode should include active DLC in the active list.',
		);
	}
	if (!store.get(inactiveModsAtom).includes('ludeon.rimworld.biotech')) {
		throw new Error(
			'Test mode should include inactive DLC in the inactive list.',
		);
	}
	if (store.get(activeModDiagnosticsAtom).errorCount !== 1) {
		throw new Error(
			'The sample missing dependency should produce one error.',
		);
	}
	if (
		store.get(workshopUpdateResultAtom)?.outdatedMods[0]?.packageId !==
			'sample.vehiclemod'
	) {
		throw new Error('Test mode should include sample update-dialog data.');
	}
	if (store.get(isModListDirtyAtom)) {
		throw new Error('The sample list should start from a clean snapshot.');
	}
});

Deno.test('exiting test mode restores prior user list and search state', () => {
	const store = createStore();
	const originalInstalledMods = [installedMod('actual.mod')];
	const originalActiveMods = ['actual.mod'];
	const originalInactiveMods = ['actual.other'];
	const originalSavedSnapshot = createModListSnapshot('1.5', [], []);
	store.set(installedModsAtom, originalInstalledMods);
	store.set(activeModsAtom, originalActiveMods);
	store.set(inactiveModsAtom, originalInactiveMods);
	store.set(configuredGameVersionAtom, '1.5');
	store.set(installedGameVersionAtom, '1.5.2812 rev1');
	store.set(sourceNameAtom, 'ModsConfig.xml');
	store.set(savedSnapshotAtom, originalSavedSnapshot);
	const originalWorkshopUpdateResult = {
		checkedCount: 1,
		skippedCount: 0,
		outdatedMods: [{
			name: 'Actual Workshop Mod',
			packageId: 'actual.mod',
			publishedFileId: '55',
			installedTimeUpdated: 1,
			steamTimeUpdated: 2,
		}],
	};
	store.set(workshopUpdateResultAtom, originalWorkshopUpdateResult);
	store.set(activeSearchAtom, 'actual');
	store.set(inactiveSearchAtom, 'other');

	store.set(toggleTestModeAtom);
	store.set(activeModsAtom, ['sample.framework']);
	store.set(toggleTestModeAtom);

	if (store.get(isTestModeAtom)) {
		throw new Error('Test mode should become inactive.');
	}
	if (store.get(installedModsAtom) !== originalInstalledMods) {
		throw new Error('The original installed mods should be restored.');
	}
	if (store.get(activeModsAtom) !== originalActiveMods) {
		throw new Error('The original active list should be restored.');
	}
	if (store.get(inactiveModsAtom) !== originalInactiveMods) {
		throw new Error('The original inactive list should be restored.');
	}
	if (
		store.get(gameVersionAtom) !== '1.5.2812 rev1' ||
		store.get(sourceNameAtom) !== 'ModsConfig.xml'
	) {
		throw new Error(
			'The original source and game version should be restored.',
		);
	}
	if (
		store.get(activeSearchAtom) !== 'actual' ||
		store.get(inactiveSearchAtom) !== 'other'
	) {
		throw new Error('The original search queries should be restored.');
	}
	if (store.get(workshopUpdateResultAtom) !== originalWorkshopUpdateResult) {
		throw new Error(
			'The previous Workshop update results should be restored.',
		);
	}
	if (!store.get(isModListDirtyAtom)) {
		throw new Error('The original dirty state should be restored.');
	}
});
