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
import type { AppController } from '@/hooks/use-app-controller';
import { createModListSnapshot } from '@/utils/dirty_state';
import { moveModBetweenLists } from '@/utils/mod_lists';
import { normalizedPackageId } from '@/utils/mods';
import type {
	InstalledMod,
	OutdatedWorkshopMod,
	WorkshopUpdateCheckResult,
} from '@/utils/types';

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
type ActiveInactiveStoryProps = {
	failWorkshopUpdateDispatch?: boolean;
	autoCheckWorkshopUpdates?: boolean;
	zeroUpdateCheck?: boolean;
	checkDelayMs?: number;
};

export async function waitForCheckForUpdatesButton(canvasElement: HTMLElement) {
	const nextFrame = () =>
		new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	await nextFrame();
	for (let frame = 0; frame < 60; frame += 1) {
		const button = canvasElement.querySelector<HTMLButtonElement>(
			'button[aria-label^="Check for updates"]',
		);
		if (button && !button.disabled) return button;
		await nextFrame();
	}
	throw new Error('The Workshop update check button must become available.');
}

const storyMods: InstalledMod[] = [
	{
		name: 'RimWorld',
		author: null,
		packageId: 'ludeon.rimworld',
		description: 'The base game content required by every mod list.',
		publishedFileId: null,
		loadAfter: [],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		versionWarningSilenced: false,
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\common\RimWorld\Data`,
		source: 'Core',
		dependencies: [],
	},
	{
		name: 'Royalty',
		author: null,
		packageId: 'ludeon.rimworld.royalty',
		description: 'Official RimWorld expansion content.',
		publishedFileId: null,
		loadAfter: ['ludeon.rimworld'],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		versionWarningSilenced: false,
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\common\RimWorld\Data\Royalty`,
		source: 'DLC',
		dependencies: [],
	},
	{
		name: 'Ideology',
		author: null,
		packageId: 'ludeon.rimworld.ideology',
		description: 'Official RimWorld expansion content.',
		publishedFileId: null,
		loadAfter: ['ludeon.rimworld'],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		versionWarningSilenced: false,
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\common\RimWorld\Data\Ideology`,
		source: 'DLC',
		dependencies: [],
	},
	{
		name: 'Biotech',
		author: null,
		packageId: 'ludeon.rimworld.biotech',
		description: 'Official RimWorld expansion content.',
		publishedFileId: null,
		loadAfter: ['ludeon.rimworld'],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		versionWarningSilenced: false,
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\common\RimWorld\Data\Biotech`,
		source: 'DLC',
		dependencies: [],
	},
	{
		name: 'Anomaly',
		author: null,
		packageId: 'ludeon.rimworld.anomaly',
		description: 'Official RimWorld expansion content.',
		publishedFileId: null,
		loadAfter: ['ludeon.rimworld'],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		versionWarningSilenced: false,
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\common\RimWorld\Data\Anomaly`,
		source: 'DLC',
		dependencies: [],
	},
	{
		name: 'Odyssey',
		author: null,
		packageId: 'ludeon.rimworld.odyssey',
		description: 'Official RimWorld expansion content.',
		publishedFileId: null,
		loadAfter: ['ludeon.rimworld'],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		versionWarningSilenced: false,
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\common\RimWorld\Data\Odyssey`,
		source: 'DLC',
		dependencies: [],
	},
	{
		name: 'Harmony',
		author: 'Brrainz',
		packageId: 'brrainz.harmony',
		description: 'Shared library used by many Workshop mods.',
		publishedFileId: '2009463077',
		loadAfter: [],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		versionWarningSilenced: false,
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\2009463077`,
		source: 'workshop',
		dependencies: [],
	},
	{
		name: 'HugsLib',
		author: 'UnlimitedHugs',
		packageId: 'unlimitedhugs.hugslib',
		description: 'Library and shared utilities for RimWorld mods.',
		publishedFileId: '818773962',
		loadAfter: ['brrainz.harmony'],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		versionWarningSilenced: false,
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\818773962`,
		source: 'workshop',
		dependencies: [],
	},
	{
		name: 'Vanilla Expanded Framework',
		author: 'Oskar Potocki',
		packageId: 'oskarpotocki.vanillafactionsexpanded.core',
		description: 'Framework for the Vanilla Expanded collection.',
		publishedFileId: '2023507013',
		loadAfter: [],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		versionWarningSilenced: false,
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\2023507013`,
		source: 'workshop',
		dependencies: [],
	},
	{
		name: 'Allow Tool',
		author: null,
		packageId: 'unlimitedhugs.allowtool',
		description: 'Additional controls for selecting and managing work.',
		publishedFileId: '761421485',
		loadAfter: ['unlimitedhugs.hugslib'],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		versionWarningSilenced: false,
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\761421485`,
		source: 'workshop',
		dependencies: [],
	},
	{
		name: 'Pick Up And Haul',
		author: null,
		packageId: 'mehni.pickupandhaul',
		description: 'Improves hauling behavior for colonists.',
		publishedFileId: '1279012058',
		loadAfter: [],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.5'],
		versionWarningSilenced: false,
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\1279012058`,
		source: 'workshop',
		dependencies: [],
	},
	{
		name:
			'Extremely Long Dependency and Version Diagnostic Sample Mod for Testing Title Truncation',
		author: 'Storybook',
		packageId: 'storybook.diagnostic.sample',
		description:
			'A long active mod name with dependency and game-version diagnostics.',
		publishedFileId: null,
		loadAfter: [],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: ['1.4'],
		versionWarningSilenced: false,
		path: String
			.raw`C:\Storybook\Mods\DiagnosticSample`,
		source: 'local',
		dependencies: [{
			packageId: 'missing.story.framework',
			name: 'Required story framework',
			alternativePackageIds: [],
		}],
	},
];

const overflowStoryMods = storyMods.slice(2)
	.filter((mod) =>
		mod.source !== 'DLC' &&
		mod.packageId !== 'storybook.diagnostic.sample'
	)
	.flatMap((mod) =>
		Array.from({ length: 4 }, (_, index) => ({
			...mod,
			name: `${mod.name} ${index + 1}`,
			packageId: `${mod.packageId}.story-${index + 1}`,
			path: `${mod.path}\\story-${index + 1}`,
		}))
	);
const loadedStoryMods = [...storyMods, ...overflowStoryMods];

const initialActiveMods = [
	'ludeon.rimworld',
	'ludeon.rimworld.royalty',
	'ludeon.rimworld.ideology',
	'ludeon.rimworld.biotech',
	'ludeon.rimworld.anomaly',
	'ludeon.rimworld.odyssey',
	'brrainz.harmony',
	'unlimitedhugs.hugslib',
	...overflowStoryMods.slice(0, 8).map((mod) => mod.packageId),
	'storybook.diagnostic.sample',
];
const initialInactiveMods = [
	'oskarpotocki.vanillafactionsexpanded.core',
	'unlimitedhugs.allowtool',
	'mehni.pickupandhaul',
	'missing.story.mod',
	...overflowStoryMods.slice(8).map((mod) => mod.packageId),
];
const knownExpansions = [
	'ludeon.rimworld.royalty',
	'ludeon.rimworld.ideology',
	'ludeon.rimworld.biotech',
	'ludeon.rimworld.anomaly',
	'ludeon.rimworld.odyssey',
];
const outdatedWorkshopMods: OutdatedWorkshopMod[] = [
	{
		name: 'Vanilla Expanded Framework',
		packageId: 'oskarpotocki.vanillafactionsexpanded.core',
		publishedFileId: '2023507013',
		installedTimeUpdated: 1717200000,
		steamTimeUpdated: 1722470400,
	},
	{
		name: 'Harmony',
		packageId: 'brrainz.harmony',
		publishedFileId: '2009463077',
		installedTimeUpdated: 1717200000,
		steamTimeUpdated: 1722470400,
	},
	{
		name: 'Allow Tool',
		packageId: 'unlimitedhugs.allowtool',
		publishedFileId: '761421485',
		installedTimeUpdated: 1717200000,
		steamTimeUpdated: 1722470400,
	},
];
const workshopUpdateResult: WorkshopUpdateCheckResult = {
	checkedCount: 7,
	skippedCount: 2,
	outdatedMods: outdatedWorkshopMods,
};
const startupWorkshopUpdateResult: WorkshopUpdateCheckResult = {
	checkedCount: 12,
	skippedCount: 0,
	outdatedMods: Array.from({ length: 12 }, (_, index) => ({
		name: `Startup Workshop Mod ${index + 1}`,
		packageId: `sample.startupmod${index + 1}`,
		publishedFileId: String(1_000_000_000 + index),
		installedTimeUpdated: 1717200000,
		steamTimeUpdated: 1722470400,
	})),
};
const zeroUpdateWorkshopResult: WorkshopUpdateCheckResult = {
	checkedCount: 7,
	skippedCount: 0,
	outdatedMods: [],
};

function createModListStoryState(
	failWorkshopUpdateDispatch = false,
	autoCheckWorkshopUpdates = false,
	zeroUpdateCheck = false,
	checkDelayMs = 0,
): ModListStoryState {
	const store = createStore();
	store.set(installedModsAtom, loadedStoryMods);
	store.set(activeModsAtom, initialActiveMods);
	store.set(inactiveModsAtom, initialInactiveMods);
	store.set(knownExpansionsAtom, knownExpansions);
	store.set(installedGameVersionAtom, '1.5.4104');
	store.set(modListLoadStateAtom, 'loaded');
	store.set(sourceNameAtom, 'Sample mod list');
	store.set(statusAtom, 'Sample mods loaded.');
	store.set(
		savedSnapshotAtom,
		createModListSnapshot('1.5.4104', initialActiveMods, knownExpansions),
	);
	store.set(isTestModeAtom, false);
	store.set(
		workshopUpdateResultAtom,
		autoCheckWorkshopUpdates ? null : workshopUpdateResult,
	);
	store.set(selectedModAtom, null);
	store.set(previewMessageAtom, 'Select a mod to review its details.');

	let startupWorkshopUpdateCheckCount = 0;

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
						loadedStoryMods.find((mod) =>
							normalizedPackageId(mod.packageId) ===
								normalizedPackageId(left)
						)?.name ?? left;
					const rightName =
						loadedStoryMods.find((mod) =>
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
			const mod = loadedStoryMods.find((installedMod) =>
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
			if (checkDelayMs > 0) {
				await new Promise<void>((resolve) =>
					setTimeout(resolve, checkDelayMs)
				);
			} else {
				await Promise.resolve();
			}
			const result = autoCheckWorkshopUpdates
				? startupWorkshopUpdateResult
				: zeroUpdateCheck
				? zeroUpdateWorkshopResult
				: workshopUpdateResult;
			if (autoCheckWorkshopUpdates) {
				startupWorkshopUpdateCheckCount += 1;
				store.set(
					statusAtom,
					`Automatic Workshop update check ${startupWorkshopUpdateCheckCount}.`,
				);
			}
			store.set(workshopUpdateResultAtom, result);
			store.set(checkingWorkshopUpdatesAtom, false);
			return result;
		},
		updateSelectedOutdatedWorkshopMods(mods) {
			if (failWorkshopUpdateDispatch) {
				return Promise.resolve({
					openedCount: 0,
					failedCount: mods.length,
				});
			}
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

export function ActiveInactiveStory(props: ActiveInactiveStoryProps) {
	const {
		failWorkshopUpdateDispatch = false,
		autoCheckWorkshopUpdates = false,
		zeroUpdateCheck = false,
		checkDelayMs = 0,
	} = props;
	const [storyState] = useState(() =>
		createModListStoryState(
			failWorkshopUpdateDispatch,
			autoCheckWorkshopUpdates,
			zeroUpdateCheck,
			checkDelayMs,
		)
	);

	return (
		<div className='flex h-dvh min-h-0 flex-col overflow-hidden'>
			<Provider store={storyState.store}>
				<AppProvider value={storyState.controller as AppController}>
					<ModListFeature />
				</AppProvider>
			</Provider>
		</div>
	);
}
