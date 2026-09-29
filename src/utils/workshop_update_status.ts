import type { WorkshopUpdateCheckResult } from './types';

export type WorkshopUpdateStatus = {
	state: 'checking' | 'updates' | 'no-updates' | 'incomplete';
	message: string;
};

export function getWorkshopUpdateStatus(
	checking: boolean,
	result: WorkshopUpdateCheckResult | null,
): WorkshopUpdateStatus | null {
	if (checking) {
		return { state: 'checking', message: 'Checking Workshop mods…' };
	}
	if (!result) return null;

	const updateCount = result.outdatedMods.length;
	if (updateCount > 0) {
		const skippedMessage = result.skippedCount > 0
			? `; ${result.skippedCount} mod${
				result.skippedCount === 1 ? '' : 's'
			} could not be checked`
			: '';
		return {
			state: 'updates',
			message: `${updateCount} mod update${
				updateCount === 1 ? '' : 's'
			} available${skippedMessage}`,
		};
	}
	if (result.checkedCount > 0 && result.skippedCount === 0) {
		return { state: 'no-updates', message: 'No updates found' };
	}
	if (result.checkedCount > 0) {
		return {
			state: 'incomplete',
			message: `No updates found; ${result.skippedCount} mod${
				result.skippedCount === 1 ? '' : 's'
			} could not be checked`,
		};
	}
	if (result.skippedCount > 0) {
		return {
			state: 'incomplete',
			message: 'No Workshop mods could be checked',
		};
	}
	return { state: 'incomplete', message: 'No Workshop mods checked' };
}
