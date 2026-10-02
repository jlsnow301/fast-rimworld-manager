import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { userEvent } from 'storybook/test';
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
	store.set(sourceNameAtom, 'Sample mod list');
	store.set(statusAtom, 'Sample mods loaded.');
	store.set(
		savedSnapshotAtom,
		createModListSnapshot('1.5.4104', initialActiveMods, knownExpansions),
	);
	store.set(isTestModeAtom, false);
	store.set(workshopUpdateResultAtom, workshopUpdateResult);
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
		const pageText = context.canvasElement.textContent ?? '';
		if (
			Array.from(context.canvasElement.querySelectorAll('h2')).some(
				(heading) => heading.textContent?.trim() === 'Mod list',
			) ||
			pageText.includes('Active mod list checks:') ||
			pageText.includes('mods with errors') ||
			pageText.includes('ModsConfig.xml') ||
			pageText.includes(
				'Drag mods between the lists to change activation.',
			) ||
			/\d+ active · \d+ inactive/.test(pageText)
		) {
			throw new Error(
				'Redundant mod-list headings and summaries must be omitted.',
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
			const count = card.querySelector('[data-slot="badge"]')?.textContent
				?.trim();
			if (
				!count || !/^\d+$/.test(count) ||
				!list || list.clientHeight === 0 ||
				list.scrollHeight <= list.clientHeight
			) {
				throw new Error(
					'Each list must show its count and scroll independently.',
				);
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
			const title = row?.querySelector('.truncate');
			const icon = row?.querySelector('svg[aria-hidden="true"]');
			if (!row || !title || !icon || icon.nextElementSibling !== title) {
				throw new Error(
					`${name} must show an official icon immediately before its title.`,
				);
			}
		}
		const ordinaryModRow = context.canvasElement.ownerDocument
			.querySelector(
				'button[aria-label^="Show details for Harmony"]',
			);
		if (
			!ordinaryModRow ||
			ordinaryModRow.querySelector(
				'svg.lucide-circle-alert, svg.lucide-triangle-alert',
			)
		) {
			throw new Error(
				'Healthy mod rows must not show diagnostic icons.',
			);
		}
		if (
			ordinaryModRow?.textContent?.trim() !== 'Harmony' ||
			ordinaryModRow.querySelector('[data-slot="badge"]')
		) {
			throw new Error(
				'Healthy rows show only the mod name and status icons.',
			);
		}
		const outdatedWorkshopRow = context.canvasElement.querySelector<
			HTMLButtonElement
		>(
			'button[aria-label^="Show details for Vanilla Expanded Framework"]',
		);
		const updateIcon = outdatedWorkshopRow?.querySelector<SVGElement>(
			'svg.lucide-download',
		);
		const updateTooltipTrigger = updateIcon?.parentElement;
		if (
			!outdatedWorkshopRow ||
			!updateIcon ||
			!updateTooltipTrigger ||
			updateTooltipTrigger.getAttribute('data-slot') !==
				'tooltip-trigger' ||
			outdatedWorkshopRow.textContent?.trim() !==
				'Vanilla Expanded Framework' ||
			outdatedWorkshopRow.querySelector('[data-slot="badge"]')
		) {
			throw new Error(
				'Workshop update status must use a tooltip trigger outside the row text.',
			);
		}
		const diagnosticModRow = context.canvasElement.querySelector<
			HTMLButtonElement
		>(
			'button[aria-label^="Show details for Extremely Long Dependency and Version Diagnostic Sample Mod"]',
		);
		const diagnosticTitle = diagnosticModRow?.querySelector<HTMLElement>(
			'.truncate',
		);
		const errorIcon = diagnosticModRow?.querySelector<SVGElement>(
			'svg.lucide-circle-alert',
		);
		const warningIcon = diagnosticModRow?.querySelector<SVGElement>(
			'svg.lucide-triangle-alert',
		);
		const errorTooltipTrigger = errorIcon?.parentElement;
		const warningTooltipTrigger = warningIcon?.parentElement;
		const diagnosticIconGroup = errorIcon?.parentElement?.parentElement;
		const diagnosticRowRect = diagnosticModRow?.getBoundingClientRect();
		const diagnosticTitleRect = diagnosticTitle?.getBoundingClientRect();
		const diagnosticIconGroupRect = diagnosticIconGroup
			?.getBoundingClientRect();
		const diagnosticLabel = diagnosticModRow?.getAttribute('aria-label') ??
			'';
		if (
			!diagnosticModRow ||
			!diagnosticTitle ||
			!errorIcon ||
			!warningIcon ||
			!diagnosticIconGroup ||
			!diagnosticRowRect ||
			!diagnosticTitleRect ||
			!diagnosticIconGroupRect ||
			diagnosticIconGroup.querySelectorAll('svg').length !== 2 ||
			errorIcon.getAttribute('aria-hidden') !== 'true' ||
			warningIcon.getAttribute('aria-hidden') !== 'true' ||
			!errorTooltipTrigger ||
			errorTooltipTrigger.getAttribute('data-slot') !==
				'tooltip-trigger' ||
			!warningTooltipTrigger ||
			warningTooltipTrigger.getAttribute('data-slot') !==
				'tooltip-trigger' ||
			!diagnosticLabel.includes('Errors:') ||
			!diagnosticLabel.includes('Warnings:') ||
			!diagnosticLabel.includes('Required story framework') ||
			!diagnosticLabel.includes('Warnings: Version mismatch: 1.5.') ||
			diagnosticLabel.includes('supported 1.4') ||
			diagnosticModRow.textContent?.trim() !==
				'Extremely Long Dependency and Version Diagnostic Sample Mod for Testing Title Truncation' ||
			diagnosticModRow.querySelector('[data-slot="badge"]') ||
			diagnosticRowRect.height > 56 ||
			getComputedStyle(diagnosticTitle).textOverflow !== 'ellipsis' ||
			diagnosticTitle.scrollWidth <= diagnosticTitle.clientWidth ||
			diagnosticTitleRect.right > diagnosticIconGroupRect.left ||
			diagnosticRowRect.right - diagnosticIconGroupRect.right > 16
		) {
			throw new Error(
				'Long active mod titles must truncate before the right-side error and warning icons while preserving issue details.',
			);
		}
		const tooltipDocument = context.canvasElement.ownerDocument;
		async function waitForTooltipContent(
			expectedText: string,
			errorMessage: string,
		) {
			for (let frame = 0; frame < 30; frame += 1) {
				const tooltipContent = tooltipDocument.querySelector<
					HTMLElement
				>(
					'[data-slot="tooltip-content"][data-open]',
				);
				if (tooltipContent?.textContent?.includes(expectedText)) return;
				await new Promise<void>((resolve) =>
					requestAnimationFrame(() => resolve())
				);
			}
			const actualText = tooltipDocument.querySelector<HTMLElement>(
				'[data-slot="tooltip-content"][data-open]',
			)?.textContent?.trim();
			throw new Error(
				`${errorMessage} Expected ${expectedText}, got ${
					actualText ?? 'no open tooltip'
				}.`,
			);
		}
		await userEvent.hover(updateTooltipTrigger);
		await waitForTooltipContent(
			'Steam update available',
			'Workshop update details must open in a shadcn tooltip.',
		);
		await userEvent.unhover(updateTooltipTrigger);
		await userEvent.hover(errorTooltipTrigger);
		await waitForTooltipContent(
			'Required story framework',
			'Error details must open in a shadcn tooltip.',
		);
		await userEvent.unhover(errorTooltipTrigger);
		warningTooltipTrigger.scrollIntoView({
			block: 'nearest',
			inline: 'nearest',
		});
		await userEvent.hover(warningTooltipTrigger);
		await waitForTooltipContent(
			'Version mismatch: 1.5.',
			'Warning details must open in a shadcn tooltip.',
		);
		const warningTooltipContent = tooltipDocument.querySelector<
			HTMLElement
		>(
			'[data-slot="tooltip-content"][data-open]',
		);
		if (
			warningTooltipContent?.textContent?.trim() !==
				'Version mismatch: 1.5.'
		) {
			throw new Error(
				'The version mismatch tooltip must show only the normalized game version.',
			);
		}
		const ownerDocument = context.canvasElement.ownerDocument;
		const inactiveSearchField = ownerDocument.querySelector<
			HTMLInputElement
		>('input[aria-label="Search inactive mods"]');
		const activeSearchField = ownerDocument.querySelector<HTMLInputElement>(
			'input[aria-label="Search active mods"]',
		);
		if (!inactiveSearchField || !activeSearchField) {
			throw new Error('Each mod list must have its own search field.');
		}
		function setSearch(field: HTMLInputElement, value: string) {
			const valueSetter = Object.getOwnPropertyDescriptor(
				Object.getPrototypeOf(field),
				'value',
			)?.set;
			if (!valueSetter) {
				throw new Error('The search field must be writable.');
			}
			valueSetter.call(field, value);
			field.dispatchEvent(new Event('input', { bubbles: true }));
		}
		async function nextFrame() {
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => resolve())
			);
		}
		function findModListPanel(title: string): HTMLElement {
			const panel = Array.from(
				ownerDocument.querySelectorAll<HTMLElement>(
					'[data-slot="card"]',
				),
			).find((candidate) =>
				candidate.querySelector('[data-slot="card-title"]')?.textContent
					?.trim() === title
			);
			if (!panel) throw new Error(`${title} panel must be rendered.`);
			return panel;
		}
		const inactivePanel = findModListPanel('Inactive mods');
		const activePanel = findModListPanel('Active mods');
		setSearch(inactiveSearchField, 'allow');
		await nextFrame();
		if (
			!inactivePanel.querySelector(
				'button[aria-label^="Show details for Allow Tool"]',
			) ||
			inactivePanel.querySelector(
				'button[aria-label^="Show details for Vanilla Expanded Framework"]',
			) ||
			!activePanel.querySelector(
				'button[aria-label^="Show details for HugsLib"]',
			) ||
			!activePanel.querySelector(
				'button[aria-label="Show details for RimWorld"]',
			)
		) {
			throw new Error(
				'Inactive search must leave active mods unchanged.',
			);
		}
		setSearch(activeSearchField, 'unlimited');
		await nextFrame();
		if (
			!activePanel.querySelector(
				'button[aria-label^="Show details for HugsLib"]',
			) ||
			activePanel.querySelector(
				'button[aria-label="Show details for RimWorld"]',
			) ||
			!inactivePanel.querySelector(
				'button[aria-label^="Show details for Allow Tool"]',
			)
		) {
			throw new Error(
				'Active search must leave inactive mods unchanged.',
			);
		}
		const inactiveDimButton = ownerDocument.querySelector<
			HTMLButtonElement
		>(
			'button[aria-label="Toggle dimming unmatched inactive mods"]',
		);
		const activeDimButton = ownerDocument.querySelector<HTMLButtonElement>(
			'button[aria-label="Toggle dimming unmatched active mods"]',
		);
		if (
			!inactiveDimButton ||
			!activeDimButton ||
			inactiveDimButton.getAttribute('aria-pressed') !== 'false' ||
			activeDimButton.getAttribute('aria-pressed') !== 'false' ||
			!inactiveDimButton.querySelector('svg.lucide-eye-off') ||
			!activeDimButton.querySelector('svg.lucide-eye-off')
		) {
			throw new Error('Each list must have an independent dim toggle.');
		}
		await userEvent.hover(inactiveDimButton);
		await waitForTooltipContent(
			'Dim unmatched mods',
			'The dim toggle must explain its action in a tooltip.',
		);
		await userEvent.unhover(inactiveDimButton);
		inactiveDimButton.click();
		await nextFrame();
		if (
			inactiveDimButton.getAttribute('aria-pressed') !== 'true' ||
			activeDimButton.getAttribute('aria-pressed') !== 'false' ||
			!inactiveDimButton.querySelector('svg.lucide-eye') ||
			!activeDimButton.querySelector('svg.lucide-eye-off')
		) {
			throw new Error('The dim toggle must change only its own list.');
		}
		const matchedTitle = inactivePanel
			.querySelector('button[aria-label^="Show details for Allow Tool"]')
			?.querySelector('.truncate');
		const dimmedTitle = inactivePanel
			.querySelector(
				'button[aria-label^="Show details for Vanilla Expanded Framework"]',
			)
			?.querySelector('.truncate');
		if (
			!matchedTitle?.parentElement ||
			matchedTitle.parentElement.classList.contains('opacity-50') ||
			!dimmedTitle?.parentElement?.classList.contains('opacity-50') ||
			activePanel.querySelector(
				'button[aria-label="Show details for RimWorld"]',
			)
		) {
			throw new Error('Dim options must affect only their own mod list.');
		}
		setSearch(inactiveSearchField, 'missing.story.mod');
		await nextFrame();
		if (
			inactivePanel.querySelector(
				'button[aria-label="Show details for missing.story.mod"]',
			) ||
			activePanel.querySelector(
				'button[aria-label="Show details for missing.story.mod"]',
			)
		) {
			throw new Error(
				'Search must exclude missing IDs even when dim mode is enabled.',
			);
		}
		setSearch(inactiveSearchField, '');
		await nextFrame();
		if (
			!inactivePanel.querySelector(
				'button[aria-label="Show details for missing.story.mod"]',
			)
		) {
			throw new Error('Clearing search must restore missing IDs.');
		}
		setSearch(activeSearchField, '');
		await nextFrame();
		const activeWarningFilterButton = ownerDocument.querySelector<
			HTMLButtonElement
		>(
			'button[aria-label="Toggle warning filter for active mods"]',
		);
		const inactiveWarningFilterButton = ownerDocument.querySelector<
			HTMLButtonElement
		>(
			'button[aria-label="Toggle warning filter for inactive mods"]',
		);
		const activeErrorFilterButton = ownerDocument.querySelector<
			HTMLButtonElement
		>(
			'button[aria-label="Toggle error filter for active mods"]',
		);
		const inactiveErrorFilterButton = ownerDocument.querySelector<
			HTMLButtonElement
		>(
			'button[aria-label="Toggle error filter for inactive mods"]',
		);
		if (
			!activeWarningFilterButton ||
			!inactiveWarningFilterButton ||
			!activeErrorFilterButton ||
			!inactiveErrorFilterButton ||
			!activeWarningFilterButton.querySelector(
				'svg.lucide-triangle-alert',
			) ||
			!activeErrorFilterButton.querySelector('svg.lucide-circle-alert') ||
			activeWarningFilterButton.getAttribute('aria-pressed') !==
				'false' ||
			inactiveWarningFilterButton.getAttribute('aria-pressed') !==
				'false' ||
			activeErrorFilterButton.getAttribute('aria-pressed') !== 'false' ||
			inactiveErrorFilterButton.getAttribute('aria-pressed') !== 'false'
		) {
			throw new Error(
				'Each mod list must render independent warning and error controls.',
			);
		}
		await userEvent.hover(activeWarningFilterButton);
		await waitForTooltipContent(
			'Filter to mods with warnings',
			'The warning filter must explain its action in a tooltip.',
		);
		await userEvent.unhover(activeWarningFilterButton);
		await userEvent.hover(activeErrorFilterButton);
		await waitForTooltipContent(
			'Filter to mods with errors',
			'The error filter must explain its action in a tooltip.',
		);
		await userEvent.unhover(activeErrorFilterButton);
		await userEvent.click(activeWarningFilterButton);
		await nextFrame();
		if (
			activeWarningFilterButton.getAttribute('aria-pressed') !== 'true' ||
			inactiveWarningFilterButton.getAttribute('aria-pressed') !==
				'false' ||
			activePanel.querySelector(
				'button[aria-label^="Show details for HugsLib"]',
			) ||
			!activePanel.querySelector(
				'button[aria-label^="Show details for Extremely Long Dependency"]',
			)
		) {
			throw new Error(
				'The warning filter must select diagnosed active mods only.',
			);
		}
		await userEvent.click(activeErrorFilterButton);
		await nextFrame();
		if (
			activeErrorFilterButton.getAttribute('aria-pressed') !== 'true' ||
			!activePanel.querySelector(
				'button[aria-label^="Show details for Extremely Long Dependency"]',
			)
		) {
			throw new Error(
				'Warning and error filters must remain independently enabled.',
			);
		}
		setSearch(activeSearchField, 'hugs');
		await nextFrame();
		if (
			activePanel.querySelector(
				'button[aria-label^="Show details for HugsLib"]',
			)
		) {
			throw new Error(
				'Severity filters must combine with search when dimming is off.',
			);
		}
		activeDimButton.click();
		await nextFrame();
		const dimmedSeverityNonmatch = activePanel
			.querySelector('button[aria-label^="Show details for HugsLib"]')
			?.querySelector('.truncate');
		if (
			!dimmedSeverityNonmatch?.parentElement?.classList.contains(
				'opacity-50',
			)
		) {
			throw new Error(
				'Dim mode must retain and dim severity-filtered nonmatches.',
			);
		}
		await userEvent.click(inactiveWarningFilterButton);
		await nextFrame();
		if (
			inactiveWarningFilterButton.getAttribute('aria-pressed') !==
				'true' ||
			activeWarningFilterButton.getAttribute('aria-pressed') !== 'true'
		) {
			throw new Error(
				'Warning filter state must remain independent across lists.',
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
		async function waitForHeading(expected: string) {
			for (let frame = 0; frame < 60; frame += 1) {
				if (
					Array.from(canvasElement.querySelectorAll('h2')).some(
						(heading) => heading.textContent?.trim() === expected,
					)
				) return;
				await nextFrame();
			}
			throw new Error(`${expected} heading did not appear.`);
		}
		async function waitForModListCards() {
			for (let frame = 0; frame < 60; frame += 1) {
				const titles = Array.from(
					canvasElement.querySelectorAll('[data-slot="card-title"]'),
				).map((title) => title.textContent?.trim());
				if (
					titles.includes('Active mods') &&
					titles.includes('Inactive mods')
				) {
					return;
				}
				await nextFrame();
			}
			throw new Error('Both mod lists did not return.');
		}
		const checkButton = Array.from(
			canvasElement.querySelectorAll('button'),
		).find((button) => button.textContent?.trim() === 'Check for updates');
		if (!checkButton) {
			throw new Error('The update check action must appear.');
		}
		checkButton.click();
		await waitForHeading('Workshop updates');
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
		await waitForModListCards();
		const checkForUpdatesButton = Array.from(
			canvasElement.querySelectorAll('button'),
		).find((button) => button.textContent?.trim() === 'Check for updates');
		if (!checkForUpdatesButton) {
			throw new Error('The update check action must remain available.');
		}
		checkForUpdatesButton.click();
		await waitForHeading('Workshop updates');
		const updateSelectedButton = Array.from(
			canvasElement.querySelectorAll('button'),
		).find((button) =>
			button.textContent?.trim() === 'Update 3 selected mods'
		);
		if (!updateSelectedButton) {
			throw new Error('All discovered updates must be selected again.');
		}
		updateSelectedButton.click();
		await waitForModListCards();
		if (
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
