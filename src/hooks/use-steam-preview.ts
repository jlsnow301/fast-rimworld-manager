import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { invokeDesktop } from '@/utils/tauri';
import type { SteamModPreview } from '@/utils/types';
import {
	previewMessageAtom,
	selectedModAtom,
	steamPreviewAtom,
} from '@/features/mod-preview/atoms';

export function useSteamPreview() {
	const [selectedMod] = useAtom(selectedModAtom);
	const [steamPreview, setSteamPreview] = useAtom(steamPreviewAtom);
	const [previewMessage, setPreviewMessage] = useAtom(previewMessageAtom);

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
