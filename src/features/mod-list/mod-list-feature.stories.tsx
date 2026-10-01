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

const meta = {
	title: 'Mod Lists/Active and Inactive',
	component: ModListFeature,
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
type ActiveInactiveStoryProps = {
	failWorkshopUpdateDispatch?: boolean;
};

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
		path: String
			.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\1279012058`,
		source: 'workshop',
		dependencies: [],
	},
];

const overflowStoryMods = storyMods.slice(2)
	.filter((mod) => mod.source !== 'DLC')
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
];
const initialInactiveMods = [
	'oskarpotocki.vanillafactionsexpanded.core',
	'unlimitedhugs.allowtool',
	'mehni.pickupandhaul',
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

function createModListStoryState(
	failWorkshopUpdateDispatch = false,
): ModListStoryState {
	const store = createStore();
	store.set(installedModsAtom, loadedStoryMods);
	store.set(activeModsAtom, initialActiveMods);
	store.set(inactiveModsAtom, initialInactiveMods);
	store.set(knownExpansionsAtom, knownExpansions);
	store.set(installedGameVersionAtom, '1.5.4104');
	store.set(modListLoadStateAtom, 'loaded');
	store.set(sourceNameAtom, 'ModsConfig.xml');
	store.set(
		statusAtom,
		`Loaded ${loadedStoryMods.length} installed mods from ModsConfig.xml.`,
	);
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
			await Promise.resolve();
			store.set(workshopUpdateResultAtom, workshopUpdateResult);
			store.set(checkingWorkshopUpdatesAtom, false);
			return workshopUpdateResult;
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

function ActiveInactiveStory(props: ActiveInactiveStoryProps) {
	const { failWorkshopUpdateDispatch = false } = props;
	const [storyState] = useState(() =>
		createModListStoryState(failWorkshopUpdateDispatch)
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

export const LoadedActiveAndInactiveLists: Story = {
	globals: { viewport: { value: 'application', isRotated: false } },
	render: () => <ActiveInactiveStory />,
	play: async (context) => {
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve())
		);
		const documentElement =
			context.canvasElement.ownerDocument.documentElement;
		if (documentElement.scrollHeight > documentElement.clientHeight) {
			throw new Error('The mod-list page must fit the viewport.');
		}
		const cardTitles = Array.from(
			context.canvasElement.ownerDocument.querySelectorAll(
				'[data-slot="card-title"]',
			),
		).map((cardTitle) => cardTitle.textContent?.trim() ?? '');
		const expectedCardTitles = [
			'Mod preview',
			'Inactive mods',
			'Active mods',
		];
		if (
			cardTitles.length !== expectedCardTitles.length ||
			cardTitles.some((title, index) =>
				title !== expectedCardTitles[index]
			)
		) {
			throw new Error(
				'Mod preview and list card titles must appear in preview, inactive, active order.',
			);
		}
		const modListCards = Array.from(
			context.canvasElement.ownerDocument.querySelectorAll(
				'[data-slot="card"]',
			),
		).filter((card) => {
			const title = card.querySelector('[data-slot="card-title"]')
				?.textContent?.trim();
			return title === 'Active mods' || title === 'Inactive mods';
		});
		if (modListCards.length !== 2) {
			throw new Error('Both mod-list panels must be rendered.');
		}
		for (const card of modListCards) {
			const list = card.querySelector<HTMLElement>('.overflow-y-auto');
			if (
				!list || list.clientHeight === 0 ||
				list.scrollHeight <= list.clientHeight
			) {
				throw new Error('Both mod lists must scroll independently.');
			}
		}
		const officialContentNames = [
			'RimWorld',
			'Royalty',
			'Ideology',
			'Biotech',
			'Anomaly',
			'Odyssey',
		];
		for (const name of officialContentNames) {
			const row = context.canvasElement.ownerDocument.querySelector(
				`button[aria-label="Show details for ${name}"]`,
			);
			const title = row?.querySelector('.break-words');
			const icon = row?.querySelector('svg[aria-hidden="true"]');
			if (!row || !title || !icon || icon.nextElementSibling !== title) {
				throw new Error(
					`${name} must show an official icon immediately before its title.`,
				);
			}
		}
		const ordinaryModRow = context.canvasElement.ownerDocument
			.querySelector(
				'button[aria-label="Show details for Harmony"]',
			);
		if (
			!ordinaryModRow ||
			ordinaryModRow.querySelector('svg[aria-hidden="true"]')
		) {
			throw new Error(
				'Ordinary mod rows must not show official content icons.',
			);
		}
	},
};

export const WorkshopUpdatesSelectionFlow: Story = {
	globals: { viewport: { value: 'application', isRotated: false } },
	render: () => <ActiveInactiveStory />,
	play: async ({ canvasElement }) => {
		const nextFrame = () =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => resolve())
			);
		const checkButton = Array.from(
			canvasElement.querySelectorAll('button'),
		).find((button) => button.textContent?.trim() === 'Check for updates');
		if (!checkButton) {
			throw new Error('The update check action must appear.');
		}
		checkButton.click();
		await nextFrame();
		if (
			!Array.from(canvasElement.querySelectorAll('h2')).some((heading) =>
				heading.textContent?.trim() === 'Workshop updates'
			)
		) {
			throw new Error(
				'Found updates must automatically open the updates page.',
			);
		}
		if (
			!canvasElement.textContent?.includes('3 selected of 3') ||
			!canvasElement.textContent?.includes(
				'2 Workshop mods could not be checked',
			)
		) {
			throw new Error(
				'All found updates and skipped-check information must be shown.',
			);
		}
		const search = canvasElement.querySelector<HTMLInputElement>(
			'[aria-label="Search Workshop updates"]',
		);
		if (!search) throw new Error('The update search must be available.');
		function setSearchValue(searchInput: HTMLInputElement, value: string) {
			const valueSetter = Object.getOwnPropertyDescriptor(
				Object.getPrototypeOf(searchInput),
				'value',
			)?.set;
			valueSetter?.call(searchInput, value);
			searchInput.dispatchEvent(new Event('input', { bubbles: true }));
		}

		setSearchValue(search, 'Brrainz.Harmony');
		await nextFrame();
		const updateList = canvasElement.querySelector(
			'[data-testid="workshop-update-list"]',
		);
		if (
			!updateList?.textContent?.includes('Harmony') ||
			updateList.textContent.includes('Vanilla Expanded Framework') ||
			updateList.textContent.includes('Allow Tool')
		) {
			throw new Error(
				'Package ID search must filter the visible updates.',
			);
		}
		const harmonyCheckbox = updateList.querySelector<HTMLElement>(
			'#workshop-update-2009463077',
		);
		if (!harmonyCheckbox) {
			throw new Error('The filtered update must remain selectable.');
		}
		harmonyCheckbox.click();
		setSearchValue(search, '');
		await nextFrame();
		const selectedSummary = Array.from(
			canvasElement.querySelectorAll('span,div'),
		).find((element) => element.textContent?.trim() === '2 selected of 3');
		if (!selectedSummary) {
			throw new Error(
				'Unchecking a filtered update must preserve hidden selections.',
			);
		}
		const backButton = Array.from(
			canvasElement.querySelectorAll('button'),
		).find((button) => button.textContent?.includes('Back to mod list'));
		if (!backButton) {
			throw new Error('The updates page must provide a return action.');
		}
		backButton.click();
		await nextFrame();
		if (
			!Array.from(canvasElement.querySelectorAll('h2')).some((heading) =>
				heading.textContent?.trim() === 'Mod list'
			)
		) {
			throw new Error('Back must return to the mod-list content.');
		}
		const checkForUpdatesButton = Array.from(
			canvasElement.querySelectorAll('button'),
		).find((button) => button.textContent?.trim() === 'Check for updates');
		if (!checkForUpdatesButton) {
			throw new Error('The update check action must remain available.');
		}
		checkForUpdatesButton.click();
		await nextFrame();
		const updateSelectedButton = Array.from(
			canvasElement.querySelectorAll('button'),
		).find((button) =>
			button.textContent?.trim() === 'Update 3 selected mods'
		);
		if (!updateSelectedButton) {
			throw new Error('All discovered updates must be selected again.');
		}
		updateSelectedButton.click();
		await nextFrame();
		if (
			!Array.from(canvasElement.querySelectorAll('h2')).some((heading) =>
				heading.textContent?.trim() === 'Mod list'
			) ||
			canvasElement.querySelector('[data-testid="workshop-update-list"]')
		) {
			throw new Error(
				'A successful update dispatch must return to the mod list.',
			);
		}
	},
};

export const WorkshopUpdatesDispatchFailure: Story = {
	globals: { viewport: { value: 'application', isRotated: false } },
	render: () => <ActiveInactiveStory failWorkshopUpdateDispatch />,
	play: async ({ canvasElement }) => {
		const nextFrame = () =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => resolve())
			);
		const checkButton = Array.from(
			canvasElement.querySelectorAll('button'),
		).find((button) => button.textContent?.trim() === 'Check for updates');
		if (!checkButton) {
			throw new Error('The update check action must appear.');
		}
		checkButton.click();
		await nextFrame();
		const updateButton = Array.from(
			canvasElement.querySelectorAll('button'),
		).find((button) =>
			button.textContent?.trim() === 'Update 3 selected mods'
		);
		if (!updateButton) {
			throw new Error('All outdated mods must be selected.');
		}
		updateButton.click();
		await nextFrame();
		const page = canvasElement.querySelector(
			'[data-testid="workshop-update-list"]',
		);
		if (
			!page ||
			!canvasElement.textContent?.includes(
				'Could not send all selected Workshop update requests to Steam.',
			)
		) {
			throw new Error(
				'A failed dispatch must stay on the updates page and show an error.',
			);
		}
	},
};
