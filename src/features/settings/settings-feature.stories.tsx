import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
import { createStore, Provider } from 'jotai';
import { AppProvider } from '@/context/app-context';
import { SettingsFeature } from '@/features/settings/settings-feature';
import {
	databaseFileStatusesAtom,
	databaseMessageAtom,
	downloadingDatabaseAtom,
	pathSettingsAtom,
	settingsMessageAtom,
	steamApiKeyConfiguredAtom,
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
			const lastModified = new Date(2026, 8, 30, 12).getTime();
			store.set(databaseFileStatusesAtom, (statuses) => [
				...(statuses ?? []).filter((status) =>
					status.database !== database
				),
				{ database, lastModified },
			]);
			const databaseName = database === 'communityRules'
				? 'Community Rules'
				: database === 'steamWorkshop'
				? 'Steam Workshop'
				: 'No Version Warning';
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
			return Promise.resolve(true);
		},
		testSteamApiConnection() {
			return Promise.resolve();
		},
		removeSteamApiKey() {
			store.set(steamApiKeyConfiguredAtom, false);
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
			'Database status is shown for all supported metadata sources.',
		);
		storyStore.set(
			databaseFileStatusesAtom,
			hasSavedPaths
				? [
					{
						database: 'communityRules',
						lastModified: new Date(2026, 8, 29, 12).getTime(),
					},
					{ database: 'steamWorkshop', lastModified: null },
					{ database: 'noVersionWarning', lastModified: null },
				]
				: [
					{ database: 'communityRules', lastModified: null },
					{ database: 'steamWorkshop', lastModified: null },
					{ database: 'noVersionWarning', lastModified: null },
				],
		);
		storyStore.set(steamApiKeyConfiguredAtom, configured);
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

export const DatabaseFileStatuses: Story = {
	render: () => <SettingsStory configured hasSavedPaths />,
	play: async ({ canvasElement }) => {
		const communityStatus = canvasElement.querySelector<HTMLElement>(
			'[aria-label="Database status for Community Rules"]',
		);
		const workshopStatus = canvasElement.querySelector<HTMLElement>(
			'[aria-label="Database status for Steam Workshop"]',
		);
		const versionWarningStatus = canvasElement.querySelector<HTMLElement>(
			'[aria-label="Database status for No Version Warning"]',
		);
		if (
			!communityStatus?.textContent?.startsWith('Last updated ') ||
			workshopStatus?.textContent?.trim() !== 'Not downloaded.' ||
			versionWarningStatus?.textContent?.trim() !== 'Not downloaded.'
		) {
			throw new Error(
				'Stored and missing databases must show their respective statuses.',
			);
		}
		const downloadButton = canvasElement.querySelector<HTMLButtonElement>(
			'button[aria-label="Download or update Steam Workshop database"]',
		);
		if (!downloadButton) {
			throw new Error(
				'The Steam Workshop download action must be available.',
			);
		}
		await userEvent.click(downloadButton);
		if (!workshopStatus.textContent?.startsWith('Last updated ')) {
			throw new Error(
				'Downloading a database must update its displayed file date.',
			);
		}
		const versionWarningDownload = canvasElement.querySelector<
			HTMLButtonElement
		>(
			'button[aria-label="Download or update No Version Warning database"]',
		);
		if (!versionWarningDownload) {
			throw new Error(
				'The No Version Warning download action must be available.',
			);
		}
		await userEvent.click(versionWarningDownload);
		if (!versionWarningStatus?.textContent?.startsWith('Last updated ')) {
			throw new Error(
				'Downloading the warning database must update its status.',
			);
		}
	},
};

export const ClearInputs: Story = {
	render: () => <SettingsStory configured hasSavedPaths />,
	play: async (context) => {
		const pathInputs = Array.from(
			context.canvasElement.querySelectorAll<HTMLInputElement>(
				'input[id^="path-"]',
			),
		);
		if (pathInputs.length !== 4) {
			throw new Error(
				'Each configured path must have a clearable input.',
			);
		}
		const expectedPathValues = pathInputs.map((input) => input.value);
		for (const [index, input] of pathInputs.entries()) {
			const field = input.closest<HTMLElement>('[data-slot="field"]');
			const clearButton = field?.querySelector<HTMLButtonElement>(
				'button[aria-label^="Clear "]',
			);
			if (
				!field || !clearButton || clearButton.disabled || !input.value
			) {
				throw new Error(
					'Configured paths must expose enabled Clear actions.',
				);
			}
			await userEvent.click(clearButton);
			expectedPathValues[index] = '';
			const updatedClearButton = field.querySelector<HTMLButtonElement>(
				'button[aria-label^="Clear "]',
			);
			if (
				pathInputs.some((pathInput, pathIndex) =>
					pathInput.value !== expectedPathValues[pathIndex]
				) ||
				!updatedClearButton?.disabled
			) {
				throw new Error(
					'Clearing one path must affect only that input.',
				);
			}
		}

		const apiKeyInput = context.canvasElement.querySelector<
			HTMLInputElement
		>('#steam-api-key');
		const apiKeyClearButton = context.canvasElement.querySelector<
			HTMLButtonElement
		>('button[aria-label="Clear Steam Web API key"]');
		const saveApiKeyButton = Array.from(
			context.canvasElement.querySelectorAll<HTMLButtonElement>('button'),
		).find((button) => button.textContent?.trim() === 'Save API key');
		const removeApiKeyButton = Array.from(
			context.canvasElement.querySelectorAll<HTMLButtonElement>('button'),
		).find((button) => button.textContent?.trim() === 'Remove key');
		if (
			!apiKeyInput ||
			!apiKeyClearButton ||
			!saveApiKeyButton ||
			!removeApiKeyButton ||
			!apiKeyClearButton.disabled
		) {
			throw new Error(
				'An empty API key field must start with Clear disabled.',
			);
		}
		await userEvent.type(apiKeyInput, 'draft-key');
		await userEvent.click(apiKeyClearButton);
		if (
			apiKeyInput.value !== '' ||
			!apiKeyClearButton.disabled ||
			!saveApiKeyButton.disabled ||
			removeApiKeyButton.disabled
		) {
			throw new Error(
				'Clearing the API key input must discard only its unsaved value.',
			);
		}
	},
};
