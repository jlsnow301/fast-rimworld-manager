import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createStore, Provider } from 'jotai';
import { AppShell } from '@/app';
import {
	activeModsAtom,
	checkingWorkshopUpdatesAtom,
	configuredGameVersionAtom,
	inactiveModsAtom,
	installedGameVersionAtom,
	installedModsAtom,
	isTestModeAtom,
	knownExpansionsAtom,
	modListLoadStateAtom,
	savedSnapshotAtom,
	sourceNameAtom,
	statusAtom,
	workshopUpdateResultAtom,
} from '@/features/mod-list/atoms';
import {
	previewMessageAtom,
	selectedModAtom,
} from '@/features/mod-preview/atoms';
import {
	databaseFileStatusesAtom,
	databaseMessageAtom,
	pathSettingsAtom,
	settingsMessageAtom,
	settingsOpenAtom,
	steamApiKeyConfiguredAtom,
} from '@/features/settings/atoms';
import type { AppController } from '@/hooks/use-app-controller';
import { createModListSnapshot } from '@/utils/dirty_state';
import { moveModBetweenLists } from '@/utils/mod_lists';
import { normalizedPackageId } from '@/utils/mods';
import { TEST_MOD_LIST } from '@/utils/test_mod_list';
import type { OutdatedWorkshopMod, PathSettings } from '@/utils/types';

const meta = {
	title: 'App',
	component: AppStory,
	parameters: {
		layout: 'fullscreen',
		viewport: {
			options: {
				application: {
					name: 'Application',
					styles: { width: '1200px', height: '800px' },
					type: 'desktop',
				},
			},
		},
	},
	tags: ['autodocs'],
} satisfies Meta<typeof AppStory>;

export default meta;
type Story = StoryObj<typeof meta>;
type StoryStore = ReturnType<typeof createStore>;
type StoryController = Pick<
	AppController,
	| 'importModList'
	| 'moveMod'
	| 'saveModList'
	| 'toggleSettings'
	| 'autoDetectPaths'
	| 'browsePath'
	| 'downloadDatabase'
	| 'savePathSettings'
	| 'updatePath'
	| 'closeModPreview'
	| 'sortMods'
	| 'selectMod'
	| 'checkForModUpdates'
	| 'updateSelectedOutdatedWorkshopMods'
	| 'refreshSteamApiKeyStatus'
	| 'saveSteamApiKey'
	| 'testSteamApiConnection'
	| 'removeSteamApiKey'
>;
type AppStoryState = {
	store: StoryStore;
	controller: StoryController;
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

function createAppStoryState(): AppStoryState {
	const store = createStore();
	const installedMods = TEST_MOD_LIST.installedMods.map((mod) =>
		mod.packageId === 'sample.vehiclemod'
			? { ...mod, publishedFileId: '123456789', source: 'workshop' }
			: mod
	);
	const activeMods = [...TEST_MOD_LIST.modList.activeMods];
	const inactiveMods = installedMods
		.filter((mod) => !activeMods.includes(mod.packageId))
		.map((mod) => mod.packageId);

	store.set(installedModsAtom, installedMods);
	store.set(activeModsAtom, activeMods);
	store.set(inactiveModsAtom, inactiveMods);
	store.set(knownExpansionsAtom, [...TEST_MOD_LIST.modList.knownExpansions]);
	store.set(installedGameVersionAtom, null);
	store.set(configuredGameVersionAtom, TEST_MOD_LIST.modList.version);
	store.set(modListLoadStateAtom, 'loaded');
	store.set(sourceNameAtom, 'Storybook demo mod list');
	store.set(
		savedSnapshotAtom,
		createModListSnapshot(
			TEST_MOD_LIST.modList.version,
			activeMods,
			TEST_MOD_LIST.modList.knownExpansions,
		),
	);
	store.set(isTestModeAtom, false);
	store.set(workshopUpdateResultAtom, TEST_MOD_LIST.updateCheckResult);
	store.set(
		selectedModAtom,
		installedMods.find((mod) => mod.packageId === 'sample.vehiclemod') ??
			null,
	);
	store.set(
		previewMessageAtom,
		'Previewing deterministic Storybook sample data.',
	);
	store.set(
		statusAtom,
		'All data and actions in this Storybook preview stay local to the story.',
	);
	store.set(settingsOpenAtom, false);
	store.set(pathSettingsAtom, samplePaths);
	store.set(
		settingsMessageAtom,
		'Example paths are shown; no system paths were detected or saved.',
	);
	store.set(
		databaseMessageAtom,
		'Database file status is shown; downloads are unavailable in this preview.',
	);
	store.set(databaseFileStatusesAtom, [
		{
			database: 'communityRules',
			lastModified: new Date(2026, 8, 29, 12).getTime(),
		},
		{ database: 'steamWorkshop', lastModified: null },
	]);
	store.set(steamApiKeyConfiguredAtom, false);

	const controller: StoryController = {
		importModList() {
			store.set(
				statusAtom,
				'Storybook preview: importing a file is unavailable.',
			);
			return Promise.resolve();
		},
		moveMod(index, source, target) {
			if (source === target) return;
			const transfer = moveModBetweenLists(
				store.get(activeModsAtom),
				store.get(inactiveModsAtom),
				index,
				source,
			);
			if (!transfer) return;
			store.set(activeModsAtom, transfer.active);
			store.set(inactiveModsAtom, transfer.inactive);
			store.set(
				statusAtom,
				`Moved ${transfer.packageId} to ${target} mods in this preview.`,
			);
		},
		saveModList() {
			store.set(
				statusAtom,
				'Storybook preview: changes were not written to RimWorld.',
			);
			return Promise.resolve();
		},
		toggleSettings() {
			store.set(settingsOpenAtom, (open) => !open);
		},
		autoDetectPaths() {
			store.set(pathSettingsAtom, samplePaths);
			store.set(
				settingsMessageAtom,
				'Storybook preview: example paths populated; no system scan was run.',
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
				`Storybook preview: example ${label} path selected; no folder was opened.`,
			);
			return Promise.resolve();
		},
		downloadDatabase(database) {
			store.set(
				databaseMessageAtom,
				`Storybook preview: ${database} database was not downloaded.`,
			);
			return Promise.resolve();
		},
		savePathSettings() {
			store.set(
				settingsMessageAtom,
				'Storybook preview: paths were not saved outside this story.',
			);
			return Promise.resolve();
		},
		updatePath(key, value) {
			store.set(pathSettingsAtom, (currentPaths) => ({
				...currentPaths,
				[key]: value,
			}));
		},
		closeModPreview() {
			store.set(selectedModAtom, null);
			store.set(
				previewMessageAtom,
				'Select a mod to review its details.',
			);
		},
		sortMods() {
			const namesByPackageId = new Map(
				installedMods.map((mod) => [
					normalizedPackageId(mod.packageId),
					mod.name,
				]),
			);
			store.set(
				activeModsAtom,
				[...store.get(activeModsAtom)].sort((left, right) =>
					(namesByPackageId.get(normalizedPackageId(left)) ?? left)
						.localeCompare(
							namesByPackageId.get(normalizedPackageId(right)) ??
								right,
						)
				),
			);
			store.set(statusAtom, 'Active mods sorted in this preview.');
			return Promise.resolve();
		},
		selectMod(packageId) {
			const selectedMod = installedMods.find((mod) =>
				normalizedPackageId(mod.packageId) ===
					normalizedPackageId(packageId)
			);
			if (!selectedMod) return;
			store.set(selectedModAtom, selectedMod);
			store.set(
				previewMessageAtom,
				'Preview details loaded from deterministic story data.',
			);
		},
		async checkForModUpdates() {
			store.set(checkingWorkshopUpdatesAtom, true);
			await Promise.resolve();
			store.set(
				workshopUpdateResultAtom,
				TEST_MOD_LIST.updateCheckResult,
			);
			store.set(checkingWorkshopUpdatesAtom, false);
			return TEST_MOD_LIST.updateCheckResult;
		},
		updateSelectedOutdatedWorkshopMods(
			mods: readonly OutdatedWorkshopMod[],
		) {
			store.set(
				statusAtom,
				`Storybook preview: ${mods.length} Workshop update selection${
					mods.length === 1 ? '' : 's'
				} were not opened in Steam.`,
			);
			return Promise.resolve({
				openedCount: 0,
				failedCount: mods.length,
			});
		},
		refreshSteamApiKeyStatus() {
			return Promise.resolve();
		},
		saveSteamApiKey() {
			return Promise.resolve(false);
		},
		testSteamApiConnection() {
			return Promise.resolve();
		},
		removeSteamApiKey() {
			store.set(steamApiKeyConfiguredAtom, false);
			return Promise.resolve();
		},
	};

	return { store, controller };
}

function AppStory() {
	const [storyState] = useState(createAppStoryState);

	return (
		<Provider store={storyState.store}>
			<AppShell controller={storyState.controller as AppController} />
		</Provider>
	);
}

function findButton(
	element: HTMLElement,
	label: string,
): HTMLButtonElement | null {
	return Array.from(element.querySelectorAll('button')).find((button) =>
		button.textContent?.trim() === label
	) ?? null;
}

async function waitForRender() {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => resolve())
	);
}

export const CompleteAppMockup: Story = {
	globals: { viewport: { value: 'application', isRotated: false } },
	render: () => <AppStory />,
	play: async ({ canvasElement }) => {
		const headerTitle = canvasElement.querySelector('header h1');
		if (headerTitle?.textContent?.trim() !== 'Fast RimWorld Manager') {
			throw new Error(
				'The complete app story must render the persistent app header.',
			);
		}

		const cardTitles = Array.from(
			canvasElement.querySelectorAll('[data-slot="card-title"]'),
		).map((title) => title.textContent?.trim() ?? '');
		const hasModPreview = cardTitles.includes('Mod preview') ||
			cardTitles.includes('Sample Vehicle Mod');
		const pageText = canvasElement.textContent ?? '';
		if (
			!hasModPreview ||
			!cardTitles.includes('Inactive mods') ||
			!cardTitles.includes('Active mods') ||
			pageText.includes('Manage RimWorld mods') ||
			pageText.includes(
				'Drag mods between the lists to change activation.',
			) ||
			pageText.includes('ModsConfig.xml') ||
			pageText.includes('Load sample list') ||
			/\d+ active · \d+ inactive/.test(pageText)
		) {
			throw new Error(
				'The app story must show both lists without redundant page text.',
			);
		}
		const diagnosticRow = canvasElement.querySelector(
			'button[aria-label^="Show details for Sample Vehicle Mod"]',
		);
		const diagnosticLabel = diagnosticRow?.getAttribute('aria-label') ?? '';
		const activeSearchField = canvasElement.querySelector(
			'input[aria-label="Search active mods"]',
		);
		const inactiveSearchField = canvasElement.querySelector(
			'input[aria-label="Search inactive mods"]',
		);
		const activeDimButton = canvasElement.querySelector<HTMLButtonElement>(
			'button[aria-label="Toggle dimming unmatched active mods"]',
		);
		const inactiveDimButton = canvasElement.querySelector<
			HTMLButtonElement
		>(
			'button[aria-label="Toggle dimming unmatched inactive mods"]',
		);
		if (
			!activeSearchField ||
			!inactiveSearchField ||
			!activeDimButton ||
			!inactiveDimButton ||
			activeDimButton.getAttribute('aria-pressed') !== 'false' ||
			inactiveDimButton.getAttribute('aria-pressed') !== 'false' ||
			!activeDimButton.querySelector('svg.lucide-eye-off') ||
			!inactiveDimButton.querySelector('svg.lucide-eye-off') ||
			!diagnosticRow?.querySelector('svg') ||
			!/(Errors|Warnings):/.test(diagnosticLabel) ||
			!diagnosticLabel.includes('Steam update available.')
		) {
			throw new Error(
				'The app story must show search, dim controls, and diagnostic and Workshop status icons.',
			);
		}
		const workshopButton = findButton(canvasElement, 'Check for updates') ??
			findButton(canvasElement, 'Preview Workshop updates');
		if (!workshopButton) {
			throw new Error(
				'The app story must expose the Workshop update flow.',
			);
		}
		workshopButton.click();
		for (
			let frame = 0;
			frame < 60 &&
			!canvasElement.textContent?.includes('Workshop updates');
			frame += 1
		) {
			await waitForRender();
		}
		if (!canvasElement.textContent?.includes('Workshop updates')) {
			throw new Error(
				'The Workshop update action must open its real page.',
			);
		}
		const workshopBackButton = findButton(
			canvasElement,
			'Back to mod list',
		);
		if (!workshopBackButton) {
			throw new Error(
				'The Workshop update page must return to the main list.',
			);
		}
		workshopBackButton.click();
		await waitForRender();

		const settingsButton = findButton(canvasElement, 'Settings');
		if (!settingsButton) {
			throw new Error('The app header must open Settings.');
		}
		settingsButton.click();
		await waitForRender();
		if (
			!canvasElement.textContent?.includes('Steam Web API') ||
			!findButton(canvasElement, 'Back') ||
			!canvasElement.querySelector('header h1')
		) {
			throw new Error(
				'Settings must render within the persistent app shell.',
			);
		}
		findButton(canvasElement, 'Back')?.click();
		await waitForRender();
		const restoredActiveSearchField = canvasElement.querySelector(
			'input[aria-label="Search active mods"]',
		);
		const restoredInactiveSearchField = canvasElement.querySelector(
			'input[aria-label="Search inactive mods"]',
		);
		const restoredCardTitles = Array.from(
			canvasElement.querySelectorAll('[data-slot="card-title"]'),
		).map((title) => title.textContent?.trim());
		if (
			!restoredActiveSearchField ||
			!restoredInactiveSearchField ||
			!restoredCardTitles.includes('Active mods') ||
			!restoredCardTitles.includes('Inactive mods')
		) {
			throw new Error('Back must restore the main mod-list view.');
		}
	},
};
