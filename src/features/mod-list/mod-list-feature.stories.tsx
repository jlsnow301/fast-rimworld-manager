import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { createStore, Provider } from 'jotai';
import { AppProvider } from '@/context/app-context';
import { ModListFeature } from '@/features/mod-list/mod-list-feature';
import {
	activeModsAtom,
	checkingWorkshopUpdatesAtom,
	inactiveModsAtom,
	installedGameVersionAtom,
	installedModsAtom,
	isTestModeAtom,
	knownExpansionsAtom,
	savedSnapshotAtom,
	sourceNameAtom,
	statusAtom,
	workshopUpdateResultAtom,
} from '@/features/mod-list/atoms';
import {
	previewMessageAtom,
	selectedModAtom,
} from '@/features/mod-preview/atoms';
import type { AppController } from '@/hooks/use-app-controller';
import { createModListSnapshot } from '@/utils/dirty_state';
import { moveModBetweenLists } from '@/utils/mod_lists';
import { normalizedPackageId } from '@/utils/mods';
import type {
	InstalledMod,
	OutdatedWorkshopMod,
	WorkshopUpdateCheckResult,
} from '@/utils/types';

const meta = {
	title: 'Mod Lists/Active and Inactive',
	component: ModListFeature,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof ModListFeature>;

export default meta;
type Story = StoryObj<typeof meta>;
type StoryStore = ReturnType<typeof createStore>;
type ModListStoryController = Pick<
	AppController,
	| 'moveMod'
	| 'sortMods'
	| 'selectMod'
	| 'checkForModUpdates'
	| 'updateSelectedOutdatedWorkshopMods'
	| 'closeModPreview'
>;
type ModListStoryState = {
	store: StoryStore;
	controller: ModListStoryController;
};

const storyMods: InstalledMod[] = [
	{
		name: 'RimWorld',
		packageId: 'ludeon.rimworld',
		description: 'The base game content required by every mod list.',
		publishedFileId: null,
		loadAfter: [],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\common\RimWorld\Data`,
		source: 'Core',
		dependencies: [],
	},
	{
		name: 'Royalty',
		packageId: 'ludeon.rimworld.royalty',
		description: 'Official RimWorld expansion content.',
		publishedFileId: null,
		loadAfter: ['ludeon.rimworld'],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\common\RimWorld\Data\Royalty`,
		source: 'DLC',
		dependencies: [],
	},
	{
		name: 'Harmony',
		packageId: 'brrainz.harmony',
		description: 'Shared library used by many Workshop mods.',
		publishedFileId: '2009463077',
		loadAfter: [],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\2009463077`,
		source: 'Workshop',
		dependencies: [],
	},
	{
		name: 'HugsLib',
		packageId: 'unlimitedhugs.hugslib',
		description: 'Library and shared utilities for RimWorld mods.',
		publishedFileId: '818773962',
		loadAfter: ['brrainz.harmony'],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\818773962`,
		source: 'Workshop',
		dependencies: [],
	},
	{
		name: 'Vanilla Expanded Framework',
		packageId: 'oskarpotocki.vanillafactionsexpanded.core',
		description: 'Framework for the Vanilla Expanded collection.',
		publishedFileId: '2023507013',
		loadAfter: [],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\2023507013`,
		source: 'Workshop',
		dependencies: [],
	},
	{
		name: 'Allow Tool',
		packageId: 'unlimitedhugs.allowtool',
		description: 'Additional controls for selecting and managing work.',
		publishedFileId: '761421485',
		loadAfter: ['unlimitedhugs.hugslib'],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\761421485`,
		source: 'Workshop',
		dependencies: [],
	},
	{
		name: 'Pick Up And Haul',
		packageId: 'mehni.pickupandhaul',
		description: 'Improves hauling behavior for colonists.',
		publishedFileId: '1279012058',
		loadAfter: [],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\1279012058`,
		source: 'Workshop',
		dependencies: [],
	},
];

const initialActiveMods = [
	'ludeon.rimworld',
	'ludeon.rimworld.royalty',
	'brrainz.harmony',
	'unlimitedhugs.hugslib',
];
const initialInactiveMods = [
	'oskarpotocki.vanillafactionsexpanded.core',
	'unlimitedhugs.allowtool',
	'mehni.pickupandhaul',
];
const knownExpansions = ['ludeon.rimworld.royalty'];
const outdatedWorkshopMod: OutdatedWorkshopMod = {
	name: 'Vanilla Expanded Framework',
	packageId: 'oskarpotocki.vanillafactionsexpanded.core',
	publishedFileId: '2023507013',
	installedTimeUpdated: 1717200000,
	steamTimeUpdated: 1722470400,
};
const workshopUpdateResult: WorkshopUpdateCheckResult = {
	checkedCount: 5,
	skippedCount: 0,
	outdatedMods: [outdatedWorkshopMod],
};

function createModListStoryState(): ModListStoryState {
	const store = createStore();
	store.set(installedModsAtom, storyMods);
	store.set(activeModsAtom, initialActiveMods);
	store.set(inactiveModsAtom, initialInactiveMods);
	store.set(knownExpansionsAtom, knownExpansions);
	store.set(installedGameVersionAtom, '1.5.4104');
	store.set(sourceNameAtom, 'ModsConfig.xml');
	store.set(statusAtom, 'Loaded 7 installed mods from ModsConfig.xml.');
	store.set(
		savedSnapshotAtom,
		createModListSnapshot('1.5.4104', initialActiveMods, knownExpansions),
	);
	store.set(isTestModeAtom, false);
	store.set(workshopUpdateResultAtom, null);
	store.set(selectedModAtom, null);
	store.set(previewMessageAtom, 'Select a mod to review its details.');

	const controller: ModListStoryController = {
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
				`Moved ${transfer.packageId} to ${target} mods.`,
			);
		},
		sortMods() {
			const sortedActiveMods = [...store.get(activeModsAtom)].sort(
				(left, right) => {
					const leftName =
						storyMods.find((mod) =>
							normalizedPackageId(mod.packageId) ===
								normalizedPackageId(left)
						)?.name ?? left;
					const rightName =
						storyMods.find((mod) =>
							normalizedPackageId(mod.packageId) ===
								normalizedPackageId(right)
						)?.name ?? right;
					return leftName.localeCompare(rightName);
				},
			);
			store.set(activeModsAtom, sortedActiveMods);
			store.set(
				statusAtom,
				'Active mods sorted alphabetically in this preview.',
			);
			return Promise.resolve();
		},
		selectMod(packageId) {
			const mod = storyMods.find((installedMod) =>
				normalizedPackageId(installedMod.packageId) ===
					normalizedPackageId(packageId)
			);
			if (!mod) return;
			store.set(selectedModAtom, mod);
			store.set(
				previewMessageAtom,
				'Mod details loaded from the story data.',
			);
		},
		async checkForModUpdates() {
			store.set(checkingWorkshopUpdatesAtom, true);
			await Promise.resolve();
			store.set(workshopUpdateResultAtom, workshopUpdateResult);
			store.set(checkingWorkshopUpdatesAtom, false);
			return workshopUpdateResult;
		},
		updateSelectedOutdatedWorkshopMods(mods) {
			store.set(
				statusAtom,
				`Storybook preview queued ${mods.length} Workshop update request${
					mods.length === 1 ? '' : 's'
				}.`,
			);
			return Promise.resolve({
				openedCount: mods.length,
				failedCount: 0,
			});
		},
		closeModPreview() {
			store.set(selectedModAtom, null);
			store.set(
				previewMessageAtom,
				'Select a mod to review its details.',
			);
		},
	};

	return { store, controller };
}

function ActiveInactiveStory() {
	const [storyState] = useState(createModListStoryState);

	return (
		<Provider store={storyState.store}>
			<AppProvider value={storyState.controller as AppController}>
				<ModListFeature />
			</AppProvider>
		</Provider>
	);
}

export const LoadedActiveAndInactiveLists: Story = {
	render: () => <ActiveInactiveStory />,
};
