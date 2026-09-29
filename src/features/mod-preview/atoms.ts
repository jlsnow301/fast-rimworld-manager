import { atom } from 'jotai';
import type { InstalledMod, SteamModPreview } from '@/utils/types';

export const selectedModAtom = atom<InstalledMod | null>(null);
export const previewMessageAtom = atom('');
export const steamPreviewAtom = atom<SteamModPreview | null>(null);
export const closeModPreviewAtom = atom(null, (_get, set) => {
	set(selectedModAtom, null);
	set(steamPreviewAtom, null);
	set(previewMessageAtom, '');
});
