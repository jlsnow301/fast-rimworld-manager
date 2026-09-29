import { createStore } from 'jotai';
import {
	checkingWorkshopUpdatesAtom,
	workshopUpdateResultAtom,
	workshopUpdateStatusAtom,
} from '../src/state/app-atoms.ts';
import { getWorkshopUpdateStatus } from '../src/utils/workshop_update_status.ts';
import type { WorkshopUpdateCheckResult } from '../src/utils/types.ts';

function updateResult(
	checkedCount: number,
	skippedCount: number,
	outdatedCount: number,
): WorkshopUpdateCheckResult {
	return {
		checkedCount,
		skippedCount,
		outdatedMods: Array.from({ length: outdatedCount }, (_, index) => ({
			name: `Mod ${index + 1}`,
			packageId: `sample.mod${index + 1}`,
			publishedFileId: String(index + 1),
			installedTimeUpdated: 100,
			steamTimeUpdated: 200,
		})),
	};
}

Deno.test('Workshop status shows progress while a check is running', () => {
	const status = getWorkshopUpdateStatus(true, null);
	if (status?.state !== 'checking') {
		throw new Error(`Expected checking status, got ${JSON.stringify(status)}`);
	}
});

Deno.test('Workshop status reports singular and plural update counts', () => {
	const oneUpdate = getWorkshopUpdateStatus(false, updateResult(3, 0, 1));
	const multipleUpdates = getWorkshopUpdateStatus(false, updateResult(3, 0, 2));
	if (
		oneUpdate?.message !== '1 mod update available' ||
		multipleUpdates?.message !== '2 mod updates available'
	) {
		throw new Error(
			`Unexpected update statuses: ${
				JSON.stringify([oneUpdate, multipleUpdates])
			}`,
		);
	}
});

Deno.test('Workshop status confirms no updates after comparable mods were checked', () => {
	const status = getWorkshopUpdateStatus(false, updateResult(4, 0, 0));
	if (status?.state !== 'no-updates' || status.message !== 'No updates found') {
		throw new Error(`Unexpected no-updates status: ${JSON.stringify(status)}`);
	}
});

Deno.test('Workshop status marks results incomplete when some mods were skipped', () => {
	const status = getWorkshopUpdateStatus(false, updateResult(4, 1, 0));
	if (
		status?.state !== 'incomplete' ||
		status.message !== 'No updates found; 1 mod could not be checked'
	) {
		throw new Error(
			`Unexpected partial-check status: ${JSON.stringify(status)}`,
		);
	}
});

Deno.test('Workshop status does not claim no updates when no mods were compared', () => {
	const status = getWorkshopUpdateStatus(false, updateResult(0, 2, 0));
	if (
		status?.state !== 'incomplete' ||
		status.message !== 'No Workshop mods could be checked'
	) {
		throw new Error(`Unexpected incomplete status: ${JSON.stringify(status)}`);
	}
});

Deno.test('Workshop status atom transitions from checking to completed results', () => {
	const store = createStore();
	store.set(checkingWorkshopUpdatesAtom, true);
	if (store.get(workshopUpdateStatusAtom)?.state !== 'checking') {
		throw new Error('The visible status should report an in-progress check.');
	}

	store.set(checkingWorkshopUpdatesAtom, false);
	store.set(workshopUpdateResultAtom, updateResult(2, 0, 0));
	if (store.get(workshopUpdateStatusAtom)?.state !== 'no-updates') {
		throw new Error('A completed clean check should report no updates.');
	}

	store.set(workshopUpdateResultAtom, updateResult(2, 0, 1));
	if (
		store.get(workshopUpdateStatusAtom)?.message !== '1 mod update available'
	) {
		throw new Error('A completed update check should report available mods.');
	}
});
