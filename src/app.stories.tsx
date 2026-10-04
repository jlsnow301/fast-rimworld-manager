import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
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
	| 'exportActiveModList'
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
		{ database: 'noVersionWarning', lastModified: null },
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
		exportActiveModList() {
			store.set(
				statusAtom,
				'Export is unavailable in this Storybook preview.',
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

type AppStoryProps = {
	testMode?: boolean;
};

function AppStory(props: AppStoryProps) {
	const { testMode = false } = props;
	const [storyState] = useState(() => {
		const state = createAppStoryState();
		if (testMode) state.store.set(isTestModeAtom, true);
		return state;
	});

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
		button.getAttribute('aria-label') === label ||
		button.textContent?.trim() === label
	) ?? null;
}

async function waitForRender() {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => resolve())
	);
}

function findModListDropTarget(
	canvasElement: HTMLElement,
	title: string,
): HTMLDivElement | null {
	const card = Array.from(
		canvasElement.querySelectorAll('[data-slot="card"]'),
	).find((candidate) =>
		candidate.querySelector('[data-slot="card-title"]')?.textContent
			.trim() === title
	);
	return card?.querySelector<HTMLDivElement>(
		`[data-mod-list-type="${
			title === 'Active mods' ? 'active' : 'inactive'
		}"]`,
	) ?? null;
}

function readModListRows(dropTarget: HTMLElement): string[] {
	return Array.from(
		dropTarget.querySelectorAll<HTMLButtonElement>(
			'button[aria-label^="Show details for"]',
		),
	).map((row) => row.textContent?.trim() ?? '');
}

async function dragModRow(source: HTMLElement, dropTarget: HTMLElement) {
	const sourceBounds = source.getBoundingClientRect();
	const targetBounds = dropTarget.getBoundingClientRect();
	const startX = sourceBounds.left + sourceBounds.width / 2;
	const startY = sourceBounds.top + sourceBounds.height / 2;
	const endX = targetBounds.left + targetBounds.width / 2;
	const endY = targetBounds.top + targetBounds.height / 2;
	const moveActions = Array.from({ length: 24 }, (_, step) => {
		const progress = (step + 1) / 24;
		return {
			pointerName: 'mouse',
			target: dropTarget,
			coords: {
				clientX: startX + (endX - startX) * progress,
				clientY: startY + (endY - startY) * progress,
			},
		};
	});
	await userEvent.pointer([
		{
			target: source,
			keys: '[MouseLeft>]',
			coords: { clientX: startX, clientY: startY },
		},
		...moveActions,
		{ keys: '[/MouseLeft]' },
	]);
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
		const toolbarButtons = Array.from(
			canvasElement.querySelectorAll('header button'),
		);
		const toolbarLabels = ['Import', 'Export', 'Save', 'Settings'];
		if (
			toolbarButtons.length !== toolbarLabels.length ||
			toolbarButtons.some((button, index) =>
				button.getAttribute('aria-label') !== toolbarLabels[index] ||
				button.textContent?.trim() !== '' ||
				!button.querySelector('svg') ||
				(index === 3 &&
					button.getAttribute('aria-expanded') !== 'false')
			)
		) {
			throw new Error(
				'Header actions must be four accessible icon-only buttons in action order.',
			);
		}
		const cardTitles = Array.from(
			canvasElement.querySelectorAll('[data-slot="card-title"]'),
		).map((title) => title.textContent?.trim() ?? '');
		const hasModPreview = cardTitles.includes('Mod preview') ||
			cardTitles.includes('Sample Vehicle Mod');
		if (
			!hasModPreview ||
			!cardTitles.includes('Inactive mods') ||
			!cardTitles.includes('Active mods')
		) {
			throw new Error(
				'The app story must render both mod lists and the preview.',
			);
		}
		const diagnosticRow = canvasElement.querySelector(
			'button[aria-label^="Show details for Sample Vehicle Mod"]',
		);
		const diagnosticLabel = diagnosticRow?.getAttribute('aria-label') ?? '';
		const activeSearchField = canvasElement.querySelector<HTMLInputElement>(
			'input[aria-label="Search active mods"]',
		);
		const inactiveSearchField = canvasElement.querySelector<
			HTMLInputElement
		>(
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
		await userEvent.click(diagnosticRow);
		await waitForRender();
		if (
			!Array.from(
				canvasElement.querySelectorAll('[data-slot="card-title"]'),
			).some((title) =>
				title.textContent?.trim() === 'Sample Vehicle Mod'
			)
		) {
			throw new Error('Clicking a mod row must select it for preview.');
		}
		const inactiveDropTarget = findModListDropTarget(
			canvasElement,
			'Inactive mods',
		);
		const activeDropTarget = findModListDropTarget(
			canvasElement,
			'Active mods',
		);
		await userEvent.type(inactiveSearchField, 'Sample Patch Pack');
		let inactivePatchPackRow: HTMLButtonElement | null = null;
		for (let frame = 0; frame < 60; frame += 1) {
			inactivePatchPackRow = canvasElement.querySelector<
				HTMLButtonElement
			>(
				'button[aria-label^="Show details for Sample Patch Pack"]',
			);
			if (inactivePatchPackRow) break;
			await waitForRender();
		}
		if (!inactiveDropTarget || !activeDropTarget || !inactivePatchPackRow) {
			throw new Error(
				'Filtered rows must remain draggable into the opposite list.',
			);
		}

		const isModListDirty = () =>
			canvasElement.querySelector('header')?.textContent?.toLowerCase()
				.includes('unsaved changes') ?? false;
		await dragModRow(inactivePatchPackRow, activeDropTarget);
		for (let frame = 0; frame < 180; frame += 1) {
			if (
				readModListRows(activeDropTarget).includes(
					'Sample Patch Pack',
				) &&
				!readModListRows(inactiveDropTarget).includes(
					'Sample Patch Pack',
				) &&
				isModListDirty()
			) break;
			await waitForRender();
		}
		await waitForRender();
		const activatedRows = readModListRows(activeDropTarget);
		const remainingInactiveRows = readModListRows(inactiveDropTarget);
		const hasUnsavedChanges = isModListDirty();
		if (
			!activatedRows.includes('Sample Patch Pack') ||
			remainingInactiveRows.includes('Sample Patch Pack') ||
			!hasUnsavedChanges
		) {
			throw new Error(
				`Dropping a filtered inactive mod into Active must move the indexed mod and mark the list dirty: ${
					JSON.stringify({
						activatedRows,
						remainingInactiveRows,
						hasUnsavedChanges,
					})
				}`,
			);
		}

		const activatedPatchPackRow = canvasElement.querySelector<
			HTMLButtonElement
		>(
			'button[aria-label^="Show details for Sample Patch Pack"]',
		);
		if (!activatedPatchPackRow) {
			throw new Error('The activated mod must remain draggable.');
		}
		await dragModRow(activatedPatchPackRow, inactiveDropTarget);
		for (let frame = 0; frame < 180; frame += 1) {
			if (
				!readModListRows(activeDropTarget).includes(
					'Sample Patch Pack',
				) &&
				readModListRows(inactiveDropTarget).includes(
					'Sample Patch Pack',
				) &&
				!isModListDirty()
			) break;
			await waitForRender();
		}
		await waitForRender();
		const restoredActiveRows = readModListRows(activeDropTarget);
		const restoredInactiveRows = readModListRows(inactiveDropTarget);
		const stillDirty = isModListDirty();
		if (
			restoredActiveRows.includes('Sample Patch Pack') ||
			!restoredInactiveRows.includes('Sample Patch Pack') ||
			stillDirty
		) {
			throw new Error(
				'Dropping the mod back in the inactive list must restore the saved list state.',
			);
		}

		const coreRow = canvasElement.querySelector<HTMLButtonElement>(
			'button[aria-label="Show details for Core"]',
		);
		if (!coreRow) {
			throw new Error('The RimWorld Core row must be present.');
		}
		await dragModRow(coreRow, inactiveDropTarget);
		await waitForRender();
		if (
			!readModListRows(activeDropTarget).includes('Core') ||
			readModListRows(inactiveDropTarget).includes('Core')
		) {
			throw new Error(
				'RimWorld Core must remain active after a drag gesture.',
			);
		}

		const workshopButton = canvasElement.querySelector<HTMLButtonElement>(
			'button[aria-label^="Check for updates"], button[aria-label^="Preview Workshop updates"]',
		);
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
		if (
			!settingsButton ||
			settingsButton.getAttribute('aria-expanded') !== 'false'
		) {
			throw new Error(
				'Settings must start closed with a stable accessible name.',
			);
		}
		settingsButton.click();
		await waitForRender();
		const expandedSettingsButton = findButton(canvasElement, 'Settings');
		if (
			!canvasElement.textContent?.includes('Steam Web API') ||
			expandedSettingsButton?.getAttribute('aria-expanded') !== 'true' ||
			!canvasElement.querySelector('header h1')
		) {
			throw new Error(
				'Settings must open while retaining its accessible name.',
			);
		}
		expandedSettingsButton?.click();
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
			!restoredCardTitles.includes('Inactive mods') ||
			findButton(canvasElement, 'Settings')?.getAttribute(
					'aria-expanded',
				) !==
				'false'
		) {
			throw new Error(
				'Settings must close and restore the main mod-list view.',
			);
		}
	},
};

export const TestModeToolbar: Story = {
	globals: { viewport: { value: 'application', isRotated: false } },
	render: () => <AppStory testMode />,
	play: async ({ canvasElement }) => {
		const toolbarButtons = Array.from(
			canvasElement.querySelectorAll('header button'),
		);
		const importButton = findButton(canvasElement, 'Import');
		const exportButton = findButton(canvasElement, 'Export');
		const saveButton = findButton(canvasElement, 'Save');
		const settingsButton = findButton(canvasElement, 'Settings');
		if (
			toolbarButtons.length !== 4 ||
			!importButton?.disabled ||
			!exportButton?.disabled ||
			!saveButton?.disabled ||
			!settingsButton ||
			settingsButton.disabled
		) {
			throw new Error(
				'Test-mode toolbar must disable Import, Export, and Save only.',
			);
		}
		settingsButton.click();
		await waitForRender();
		if (
			findButton(canvasElement, 'Settings')?.getAttribute(
					'aria-expanded',
				) !==
				'true' ||
			!canvasElement.textContent?.includes('Steam Web API')
		) {
			throw new Error(
				'Settings must remain a working toolbar toggle in test mode.',
			);
		}
	},
};
