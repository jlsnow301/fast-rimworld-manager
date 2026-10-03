import type { Meta, StoryObj } from '@storybook/react-vite';
import {
	ActiveInactiveStory,
	waitForCheckForUpdatesButton,
} from '@/features/mod-list/mod-list-story-fixtures';
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
		const checkButton = await waitForCheckForUpdatesButton(canvasElement);
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
		const checkForUpdatesButton = await waitForCheckForUpdatesButton(
			canvasElement,
		);
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
		const checkButton = await waitForCheckForUpdatesButton(canvasElement);
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
