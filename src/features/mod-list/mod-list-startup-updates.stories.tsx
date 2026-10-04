import { userEvent } from 'storybook/test';
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

export const StartupWorkshopUpdateCount: Story = {
	globals: { viewport: { value: 'application', isRotated: false } },
	render: () => <ActiveInactiveStory autoCheckWorkshopUpdates />,
	play: async ({ canvasElement }) => {
		const ownerDocument = canvasElement.ownerDocument;
		const buttonSelector =
			'button[aria-label="Check for updates, 12 updates available"]';
		let updateButton: HTMLButtonElement | null = null;
		for (let frame = 0; frame < 60; frame += 1) {
			updateButton = ownerDocument.querySelector<HTMLButtonElement>(
				buttonSelector,
			);
			if (updateButton) break;
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => resolve())
			);
		}
		const updateCountBadge = updateButton?.querySelector<HTMLElement>(
			'[data-slot="badge"]',
		);
		const statusMessage = canvasElement.querySelector(
			'p[aria-live="polite"]',
		)?.textContent?.trim();
		if (
			!updateButton ||
			updateCountBadge?.textContent?.trim() !== '9+' ||
			statusMessage !== 'Automatic Workshop update check 1.' ||
			!canvasElement.querySelector(
				'input[aria-label="Search active mods"]',
			) ||
			!canvasElement.querySelector(
				'input[aria-label="Search inactive mods"]',
			) ||
			canvasElement.querySelector('[data-testid="workshop-update-list"]')
		) {
			throw new Error(
				'Startup must check updates once, keep the mod lists open, and cap the button count at 9+.',
			);
		}
	},
};

export const WorkshopUpdateButtonFeedback: Story = {
	globals: { viewport: { value: 'application', isRotated: false } },
	render: () => <ActiveInactiveStory zeroUpdateCheck checkDelayMs={200} />,
	play: async ({ canvasElement }) => {
		const button = await waitForCheckForUpdatesButton(canvasElement);
		await userEvent.click(button);

		const waitForIcon = async (selector: string) => {
			for (let frame = 0; frame < 60; frame += 1) {
				const icon = button.querySelector(selector);
				if (icon) return icon;
				await new Promise<void>((resolve) =>
					requestAnimationFrame(() => resolve())
				);
			}
			return null;
		};
		const spinner = await waitForIcon(
			'svg[role="img"][aria-label="Checking for Workshop updates"]',
		);
		const spinnerAnimationName = spinner
			? canvasElement.ownerDocument.defaultView?.getComputedStyle(spinner)
				.animationName
			: undefined;
		if (
			!spinner || !spinnerAnimationName ||
			spinnerAnimationName === 'none' ||
			!button.disabled ||
			button.textContent?.trim() !== 'Check for updates'
		) {
			throw new Error(
				'The update button must keep its label and show a spinner while checking.',
			);
		}

		const checkmark = await waitForIcon('svg.lucide-check');
		if (
			!checkmark ||
			canvasElement.textContent?.includes('No updates found') ||
			canvasElement.textContent?.includes(
				'Checking installed Workshop mods',
			)
		) {
			throw new Error(
				'A complete zero-update check must show only the button checkmark, not status prose.',
			);
		}

		await new Promise<void>((resolve) => setTimeout(resolve, 1900));
		if (button.querySelector('svg.lucide-check')) {
			throw new Error(
				'The zero-update checkmark must disappear after its brief confirmation.',
			);
		}
	},
};
