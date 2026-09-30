import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createStore, Provider } from 'jotai';
import { AppProvider } from '@/context/app-context';
import { SettingsFeature } from '@/features/settings/settings-feature';
import {
	databaseMessageAtom,
	downloadingDatabaseAtom,
	pathSettingsAtom,
	settingsMessageAtom,
	steamApiKeyConfiguredAtom,
	steamApiMessageAtom,
} from '@/features/settings/atoms';
import type { AppController } from '@/hooks/use-app-controller';
import { EMPTY_PATH_SETTINGS } from '@/utils/mods';
import type { PathSettings } from '@/utils/types';

const meta = {
	title: 'Settings/Settings Feature',
	component: SettingsFeature,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof SettingsFeature>;

export default meta;
type Story = StoryObj<typeof meta>;
type StoryStore = ReturnType<typeof createStore>;
type SettingsStoryController = Pick<
	AppController,
	| 'autoDetectPaths'
	| 'browsePath'
	| 'downloadDatabase'
	| 'savePathSettings'
	| 'updatePath'
	| 'saveSteamApiKey'
	| 'testSteamApiConnection'
	| 'removeSteamApiKey'
>;
type SettingsStoryProps = {
	configured: boolean;
	hasSavedPaths: boolean;
};

const samplePaths: PathSettings = {
	gamePath: String
		.raw`C:\Program Files (x86)\Steam\steamapps\common\RimWorld`,
	configPath: String
		.raw`C:\Users\Player\AppData\LocalLow\Ludeon Studios\RimWorld by Ludeon Studios\Config`,
	localModsPath: String
		.raw`C:\Users\Player\AppData\LocalLow\Ludeon Studios\RimWorld by Ludeon Studios\Mods`,
	workshopPath: String
		.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100`,
};

function createSettingsStoryController(
	store: StoryStore,
): SettingsStoryController {
	return {
		autoDetectPaths() {
			const currentPaths = store.get(pathSettingsAtom);
			store.set(pathSettingsAtom, {
				gamePath: currentPaths.gamePath || samplePaths.gamePath,
				configPath: currentPaths.configPath || samplePaths.configPath,
				localModsPath: currentPaths.localModsPath ||
					samplePaths.localModsPath,
				workshopPath: currentPaths.workshopPath ||
					samplePaths.workshopPath,
			});
			store.set(
				settingsMessageAtom,
				'Detected 4 paths. Review and save them.',
			);
			return Promise.resolve();
		},
		browsePath(key, label) {
			store.set(pathSettingsAtom, (currentPaths) => ({
				...currentPaths,
				[key]: samplePaths[key],
			}));
			store.set(
				settingsMessageAtom,
				`${label} selected. Save paths to apply it.`,
			);
			return Promise.resolve();
		},
		downloadDatabase(database) {
			store.set(downloadingDatabaseAtom, database);
			const databaseName = database === 'communityRules'
				? 'Community Rules'
				: 'Steam Workshop';
			store.set(databaseMessageAtom, `Updated ${databaseName} database.`);
			store.set(downloadingDatabaseAtom, null);
			return Promise.resolve();
		},
		savePathSettings() {
			store.set(
				settingsMessageAtom,
				'Paths saved. Installed mods refreshed.',
			);
			return Promise.resolve();
		},
		updatePath(key, value) {
			store.set(pathSettingsAtom, (currentPaths) => ({
				...currentPaths,
				[key]: value,
			}));
		},
		saveSteamApiKey(apiKey) {
			if (apiKey.trim().length === 0) return Promise.resolve(false);
			store.set(steamApiKeyConfiguredAtom, true);
			store.set(steamApiMessageAtom, 'Steam Web API key saved securely.');
			return Promise.resolve(true);
		},
		testSteamApiConnection() {
			store.set(
				steamApiMessageAtom,
				'Steam Web API connection verified.',
			);
			return Promise.resolve();
		},
		removeSteamApiKey() {
			store.set(steamApiKeyConfiguredAtom, false);
			store.set(steamApiMessageAtom, 'Steam Web API key removed.');
			return Promise.resolve();
		},
	};
}

function SettingsStory(props: SettingsStoryProps) {
	const { configured, hasSavedPaths } = props;
	const [store] = useState(() => {
		const storyStore = createStore();
		storyStore.set(
			pathSettingsAtom,
			hasSavedPaths ? samplePaths : EMPTY_PATH_SETTINGS,
		);
		storyStore.set(
			settingsMessageAtom,
			hasSavedPaths
				? 'Saved RimWorld and Workshop folders are ready.'
				: 'No saved paths. Enter locations or auto-detect them.',
		);
		storyStore.set(
			databaseMessageAtom,
			'Community Rules updated yesterday. Steam Workshop metadata is ready.',
		);
		storyStore.set(steamApiKeyConfiguredAtom, configured);
		storyStore.set(
			steamApiMessageAtom,
			configured
				? 'Steam Web API key status checked.'
				: 'No Steam Web API key is stored.',
		);
		return storyStore;
	});
	const controller = createSettingsStoryController(store);

	return (
		<Provider store={store}>
			<AppProvider value={controller as AppController}>
				<SettingsFeature />
			</AppProvider>
		</Provider>
	);
}

export const ConfiguredInstallation: Story = {
	render: () => <SettingsStory configured hasSavedPaths />,
};

export const FirstRunSetup: Story = {
	render: () => <SettingsStory configured={false} hasSavedPaths={false} />,
};
