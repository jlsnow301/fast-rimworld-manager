import { atom } from 'jotai';
import { EMPTY_PATH_SETTINGS } from '../../utils/mods';
import type { DatabaseKind, PathSettings } from '../../utils/types';

export const settingsOpenAtom = atom(false);
export const pathSettingsAtom = atom<PathSettings>(EMPTY_PATH_SETTINGS);
export const settingsMessageAtom = atom('Loading saved paths.');
export const databaseMessageAtom = atom(
	'Databases are saved in the app data folder.',
);
export const steamApiKeyConfiguredAtom = atom(false);
export const steamApiMessageAtom = atom(
	'Steam Web API key status has not been checked.',
);
export const downloadingDatabaseAtom = atom<DatabaseKind | null>(null);
