import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { createStore, Provider } from 'jotai';
import { AppProvider } from '@/context/app-context';
import {
	activeModsAtom,
	installedGameVersionAtom,
	installedModsAtom,
} from '@/features/mod-list/atoms';
import {
	previewMessageAtom,
	selectedModAtom,
	steamPreviewAtom,
} from '@/features/mod-preview/atoms';
import { ModPreviewFeature } from '@/features/mod-preview/mod-preview-feature';
import type { AppController } from '@/hooks/use-app-controller';
import type { InstalledMod, SteamModPreview } from '@/utils/types';

const meta = {
	title: 'Mod Preview/Installed Details',
	component: ModPreviewFeature,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof ModPreviewFeature>;

export default meta;
type Story = StoryObj<typeof meta>;
type StoryStore = ReturnType<typeof createStore>;
type PreviewStoryController = Pick<AppController, 'closeModPreview'>;
type PreviewStoryProps = {
	loading?: boolean;
};

function assertPreviewDoesNotScroll(card: HTMLElement) {
	const cardContent = card.querySelector<HTMLElement>(
		'[data-slot="card-content"]',
	);
	const previewColumn = card.parentElement;
	if (!cardContent || !previewColumn) {
		throw new Error(
			'The preview must have a card content area and column.',
		);
	}
	const contentOverflow = getComputedStyle(cardContent).overflowY;
	const columnOverflow = getComputedStyle(previewColumn).overflowY;
	if (
		card.clientHeight === 0 || cardContent.clientHeight === 0 ||
		contentOverflow === 'auto' || contentOverflow === 'scroll' ||
		columnOverflow === 'auto' || columnOverflow === 'scroll' ||
		cardContent.scrollHeight > cardContent.clientHeight
	) {
		throw new Error('The mod preview must not scroll vertically.');
	}
}

const previewMod: InstalledMod = {
	name: 'Sample Vehicle Mod',
	author: 'Workshop Author',
	packageId: 'sample.vehiclemod',
	description: 'Installed About.xml description for the sample mod.',
	publishedFileId: '123456789',
	loadAfter: [],
	loadBefore: [],
	incompatibleWith: [],
	supportedVersions: ['1.6'],
	versionWarningSilenced: false,
	path: String
		.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\123456789\Mods\SampleVehicleMod`,
	source: 'workshop',
	dependencies: [
		{
			packageId: 'sample.framework',
			name: 'Missing Framework',
			alternativePackageIds: [],
		},
	],
};

function createSteamPreview(): SteamModPreview {
	return {
		publishedFileId: '123456789',
		title: previewMod.name,
		description: 'Sample Workshop description.',
		previewUrl:
			'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
		timeUpdated: 1722470400,
	};
}

function createPreviewStoryStore(loading = false): StoryStore {
	const store = createStore();
	store.set(installedModsAtom, [previewMod]);
	store.set(activeModsAtom, [previewMod.packageId]);
	store.set(installedGameVersionAtom, '1.6');
	store.set(selectedModAtom, previewMod);
	store.set(steamPreviewAtom, loading ? null : createSteamPreview());
	store.set(
		previewMessageAtom,
		loading
			? 'Loading Steam Workshop details…'
			: 'Steam Workshop details loaded.',
	);
	return store;
}

function PreviewStory(props: PreviewStoryProps) {
	const { loading = false } = props;
	const [store] = useState(() => createPreviewStoryStore(loading));
	useEffect(() => {
		if (!loading) return;
		const timeoutId = globalThis.setTimeout(() => {
			store.set(steamPreviewAtom, createSteamPreview());
			store.set(previewMessageAtom, 'Steam Workshop details loaded.');
		}, 1000);
		return () => globalThis.clearTimeout(timeoutId);
	}, [loading, store]);
	const controller: PreviewStoryController = {
		closeModPreview() {
			store.set(selectedModAtom, null);
		},
	};

	return (
		<div className='grid h-dvh min-h-0 grid-cols-1 p-6'>
			<Provider store={store}>
				<AppProvider value={controller as AppController}>
					<ModPreviewFeature />
				</AppProvider>
			</Provider>
		</div>
	);
}

export const InfoShowsOnDiskDetails: Story = {
	render: () => <PreviewStory />,
	play: async ({ canvasElement, userEvent }) => {
		const document = canvasElement.ownerDocument;
		const infoButton = canvasElement.querySelector<HTMLButtonElement>(
			'button[aria-label="Show on-disk details"]',
		);
		const previewCloseButton = canvasElement.querySelector<
			HTMLButtonElement
		>(
			'button[aria-label="Close mod preview"]',
		);
		if (
			!infoButton || infoButton.textContent?.trim() ||
			!infoButton.querySelector('svg') || !previewCloseButton ||
			previewCloseButton.textContent?.trim() ||
			!previewCloseButton.querySelector('svg')
		) {
			throw new Error(
				'Preview actions must be icon-only buttons with accessible names.',
			);
		}
		async function waitForTooltip(expectedText: string) {
			for (let frame = 0; frame < 30; frame += 1) {
				const tooltip = document.querySelector<HTMLElement>(
					'[data-slot="tooltip-content"][data-open]',
				);
				if (tooltip?.textContent?.includes(expectedText)) return;
				await new Promise<void>((resolve) =>
					requestAnimationFrame(() => resolve())
				);
			}
			throw new Error(`The ${expectedText} tooltip must open.`);
		}
		await userEvent.hover(infoButton);
		await waitForTooltip('Show on-disk details');
		await userEvent.unhover(infoButton);
		await userEvent.hover(previewCloseButton);
		await waitForTooltip('Close mod preview');
		await userEvent.unhover(previewCloseButton);
		await userEvent.click(infoButton);

		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve())
		);

		const dialog = document.querySelector('[role="dialog"]');
		if (!dialog) throw new Error('Info must open the mod details dialog.');
		const detailsText = dialog.textContent ?? '';
		for (
			const detail of [
				'Package ID',
				'sample.vehiclemod',
				'Steam Workshop ID',
				String
					.raw`C:\Program Files (x86)\Steam\steamapps\workshop\content\294100\123456789\Mods\SampleVehicleMod`,
				'123456789',
				'Installed About.xml description for the sample mod.',
				'Missing dependencies',
				'Missing Framework',
			]
		) {
			if (!detailsText.includes(detail)) {
				throw new Error(`The details dialog must show ${detail}.`);
			}
		}
		if (dialog.scrollWidth > dialog.clientWidth) {
			throw new Error(
				'The mod details dialog must not require horizontal scrolling.',
			);
		}
		if (
			Array.from(dialog.querySelectorAll('h3')).some((heading) =>
				heading.textContent?.trim() === 'Steam Workshop'
			)
		) {
			throw new Error(
				'The on-disk details dialog must not show a Steam Workshop section.',
			);
		}

		if (dialog.querySelectorAll('button').length !== 1) {
			throw new Error(
				'The primary Close action must be the only dialog button.',
			);
		}
		const closeButton = dialog.querySelector<HTMLButtonElement>(
			'[data-slot="dialog-footer"] button',
		);
		if (!closeButton || !closeButton.className.includes('bg-primary')) {
			throw new Error(
				'The dialog Close action must be visually primary.',
			);
		}
		await userEvent.click(closeButton);
		await new Promise<void>((resolve) => setTimeout(resolve, 200));
		const closedDialog = document.querySelector('[role="dialog"]');
		if (closedDialog && getComputedStyle(closedDialog).display !== 'none') {
			throw new Error(
				'The dialog must close from its primary Close action.',
			);
		}
		await userEvent.click(previewCloseButton);
		if (
			!canvasElement.textContent?.includes(
				'Select a mod to see its details.',
			)
		) {
			throw new Error(
				'The icon-only Close action must close the preview.',
			);
		}
	},
};

export const LoadingKeepsPreviewHeight: Story = {
	render: () => <PreviewStory loading />,
	play: async ({ canvasElement }) => {
		const card = canvasElement.querySelector<HTMLElement>(
			'[data-slot="card"]',
		);
		const loadingStatus = canvasElement.querySelector(
			'[aria-label="Loading mod preview"]',
		);
		if (!card || !loadingStatus) {
			throw new Error('The mod preview must show its loading Skeleton.');
		}
		if (card.querySelectorAll('[data-slot="skeleton"]').length === 0) {
			throw new Error('The loading state must render shadcn Skeletons.');
		}
		assertPreviewDoesNotScroll(card);
		const loadingHeight = card.getBoundingClientRect().height;
		await new Promise<void>((resolve) => setTimeout(resolve, 1100));
		const loadedHeight = card.getBoundingClientRect().height;
		if (loadedHeight !== loadingHeight) {
			throw new Error(
				`The preview boundary changed from ${loadingHeight}px to ${loadedHeight}px.`,
			);
		}
		assertPreviewDoesNotScroll(card);
		if (
			!canvasElement.querySelector(
				'img[alt="Sample Vehicle Mod Workshop preview"]',
			)
		) {
			throw new Error('The resolved mod preview must show its image.');
		}
		if (!canvasElement.textContent?.includes('Workshop Author')) {
			throw new Error(
				'The resolved mod preview must preserve its content.',
			);
		}
	},
};
