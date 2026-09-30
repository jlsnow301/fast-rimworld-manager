import type { OutdatedWorkshopMod } from '@/utils/types';

const WORKSHOP_ID_PATTERN = /^[0-9]+$/;
const MAX_WORKSHOP_ID = '18446744073709551615';
const RIMWORLD_APP_ID = '294100';
export type WorkshopPageUrls = {
	browser: string;
	steam: string;
};

function validWorkshopId(value: string | null): string | null {
	const publishedFileId = value?.trim() ?? '';
	if (
		!WORKSHOP_ID_PATTERN.test(publishedFileId) ||
		/^0+$/.test(publishedFileId) ||
		publishedFileId.length > MAX_WORKSHOP_ID.length ||
		(publishedFileId.length === MAX_WORKSHOP_ID.length &&
			publishedFileId > MAX_WORKSHOP_ID)
	) {
		return null;
	}
	return publishedFileId;
}

export function steamWorkshopPageUrls(
	publishedFileId: string | null,
): WorkshopPageUrls | null {
	const id = validWorkshopId(publishedFileId);
	if (!id) return null;
	return {
		browser: `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`,
		steam: `steam://url/CommunityFilePage/${id}`,
	};
}

export function steamWorkshopDownloadUrls(
	outdatedMods: readonly OutdatedWorkshopMod[],
): string[] {
	const seenIds = new Set<string>();
	const urls: string[] = [];

	for (const mod of outdatedMods) {
		const publishedFileId = validWorkshopId(mod.publishedFileId);
		if (!publishedFileId || seenIds.has(publishedFileId)) {
			continue;
		}

		seenIds.add(publishedFileId);
		urls.push(
			`steam://workshop_download_item/${RIMWORLD_APP_ID}/${publishedFileId}`,
		);
	}

	return urls;
}
