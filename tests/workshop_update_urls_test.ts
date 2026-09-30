import {
	steamWorkshopDownloadUrls,
	steamWorkshopPageUrls,
} from '@/utils/workshop_update_urls.ts';
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

Deno.test('bulk updates include each valid outdated Workshop item once', () => {
	const result = steamWorkshopDownloadUrls([
		outdatedMod('123'),
		outdatedMod('456'),
		outdatedMod('123'),
	]);
	const expected = [
		'steam://workshop_download_item/294100/123',
		'steam://workshop_download_item/294100/456',
	];

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${
				JSON.stringify(result)
			}`,
		);
	}
});

Deno.test('bulk updates discard invalid Workshop identifiers', () => {
	const result = steamWorkshopDownloadUrls([
		outdatedMod(''),
		outdatedMod('0'),
		outdatedMod('steam://openurl/example'),
		outdatedMod('18446744073709551616'),
	]);

	if (result.length !== 0) {
		throw new Error(
			`Invalid Workshop IDs produced URLs: ${JSON.stringify(result)}`,
		);
	}
});

Deno.test('Workshop links use fixed browser and Steam destinations', () => {
	const result = steamWorkshopPageUrls(' 123456789 ');
	const expected = {
		browser:
			'https://steamcommunity.com/sharedfiles/filedetails/?id=123456789',
		steam: 'steam://url/CommunityFilePage/123456789',
	};

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${
				JSON.stringify(result)
			}`,
		);
	}
});

Deno.test('Workshop page links reject missing and unsafe identifiers', () => {
	for (
		const publishedFileId of [
			null,
			'',
			'0',
			'steam://openurl/example',
			'123?url=https://example.com',
			'18446744073709551616',
		]
	) {
		if (steamWorkshopPageUrls(publishedFileId) !== null) {
			throw new Error(
				`Unsafe Workshop ID produced a destination: ${publishedFileId}`,
			);
		}
	}
});

Deno.test('Workshop page links accept the maximum unsigned ID', () => {
	const result = steamWorkshopPageUrls('18446744073709551615');
	const expected = {
		browser:
			'https://steamcommunity.com/sharedfiles/filedetails/?id=18446744073709551615',
		steam: 'steam://url/CommunityFilePage/18446744073709551615',
	};

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${
				JSON.stringify(result)
			}`,
		);
	}
});
