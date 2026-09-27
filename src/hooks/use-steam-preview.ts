import { useEffect, useState } from 'react';
import { invokeDesktop } from '../utils/tauri';
import type { InstalledMod, SteamModPreview } from '../utils/types';

export function useSteamPreview(selectedMod: InstalledMod | null) {
	const [steamPreview, setSteamPreview] = useState<SteamModPreview | null>(
		null,
	);
	const [previewMessage, setPreviewMessage] = useState('');

	useEffect(() => {
		if (!selectedMod) return;

		let cancelled = false;
		setSteamPreview(null);
		if (!selectedMod.publishedFileId) {
			setPreviewMessage('This mod does not include a Steam Workshop ID.');
			return () => {
				cancelled = true;
			};
		}

		setPreviewMessage('Loading Steam Workshop details…');
		void invokeDesktop<SteamModPreview | null>('fetch_steam_mod_details', {
			publishedFileId: selectedMod.publishedFileId,
		})
			.then((preview) => {
				if (cancelled) return;
				setSteamPreview(preview);
				setPreviewMessage(
					preview
						? 'Steam Workshop details loaded.'
						: 'Steam item is unavailable.',
				);
			})
			.catch((error) => {
				if (cancelled) return;
				setPreviewMessage(
					error instanceof Error ? error.message : String(error),
				);
			});

		return () => {
			cancelled = true;
		};
	}, [selectedMod]);

	return { previewMessage, steamPreview };
}
