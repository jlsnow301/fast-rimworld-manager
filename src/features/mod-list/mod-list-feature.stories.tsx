import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
import { ActiveInactiveStory } from '@/features/mod-list/mod-list-story-fixtures';
import { ModListFeature } from '@/features/mod-list/mod-list-feature';

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
		const emptyPreviewCard = Array.from(
			context.canvasElement.ownerDocument.querySelectorAll<HTMLElement>(
				'[data-slot="card"]',
			),
		).find((card) =>
			card.querySelector('[data-slot="card-title"]')?.textContent
				?.trim() ===
				'Mod preview'
		);
		const emptyPreviewContent = emptyPreviewCard?.querySelector<
			HTMLElement
		>(
			'[data-slot="card-content"]',
		);
		if (
			!emptyPreviewCard || !emptyPreviewContent ||
			Math.abs(
					emptyPreviewCard.getBoundingClientRect().height /
							documentElement.clientHeight - 0.48,
				) > 0.03 ||
			emptyPreviewContent.scrollHeight > emptyPreviewContent.clientHeight
		) {
			throw new Error(
				'The empty preview card must stay at 48dvh without scrolling.',
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
		const scrollViewports = modListCards.map((card) =>
			card.querySelector<HTMLElement>(
				'[data-slot="scroll-area-viewport"]',
			)
		);
		const [inactiveList, activeList] = scrollViewports;
		const listTypes = modListCards.map((card) =>
			card.querySelector<HTMLElement>('[data-mod-list-type]')?.dataset
				.modListType
		);
		for (const [index, card] of modListCards.entries()) {
			const count = card.querySelector('[data-slot="badge"]')?.textContent
				?.trim();
			const list = scrollViewports[index];
			if (
				!count || !/^[0-9]+$/.test(count) || !list ||
				list.clientHeight === 0 ||
				list.scrollHeight <= list.clientHeight
			) {
				throw new Error(
					'Each mod list must have a count and its own scrollable viewport.',
				);
			}
		}
		if (
			!inactiveList || !activeList ||
			listTypes[0] !== 'inactive' || listTypes[1] !== 'active'
		) {
			throw new Error(
				'Each independent scroll viewport must remain bound to its own drop target.',
			);
		}
		inactiveList.scrollTop = inactiveList.scrollHeight;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve())
		);
		const inactiveScrollTop = inactiveList.scrollTop;
		if (inactiveScrollTop === 0 || activeList.scrollTop !== 0) {
			throw new Error(
				'Scrolling the inactive list must not scroll the active list.',
			);
		}
		activeList.scrollTop = activeList.scrollHeight;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve())
		);
		if (
			activeList.scrollTop === 0 ||
			inactiveList.scrollTop !== inactiveScrollTop
		) {
			throw new Error(
				'Scrolling the active list must not scroll the inactive list.',
			);
		}
		inactiveList.scrollTop = 0;
		activeList.scrollTop = 0;
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
