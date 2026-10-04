import { cn } from 'cn';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
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
type PreviewUrl = SteamModPreview['previewUrl'];
type PreviewStoryProps = {
	loading?: boolean;
	previewUrl?: PreviewUrl;
	narrowPreviewColumn?: boolean;
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
	modVersion: '2.3.4',
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

const storyPreviewUrl: PreviewUrl =
	'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22160%22%20height=%2290%22%20viewBox=%220%200%20160%2090%22%3E%3Crect%20width=%22160%22%20height=%2290%22%20fill=%22%233b82f6%22/%3E%3Ccircle%20cx=%2280%22%20cy=%2245%22%20r=%2225%22%20fill=%22%23f8fafc%22/%3E%3C/svg%3E';

function createSteamPreview(
	previewUrl: PreviewUrl = storyPreviewUrl,
): SteamModPreview {
	return {
		publishedFileId: '123456789',
		title: previewMod.name,
		description: 'Sample Workshop description.',
		previewUrl,
		timeUpdated: 1722470400,
	};
}

function createPreviewStoryStore(
	loading = false,
	previewUrl: PreviewUrl = storyPreviewUrl,
): StoryStore {
	const store = createStore();
	store.set(installedModsAtom, [previewMod]);
	store.set(activeModsAtom, [previewMod.packageId]);
	store.set(installedGameVersionAtom, '1.6');
	store.set(selectedModAtom, previewMod);
	store.set(
		steamPreviewAtom,
		loading ? null : createSteamPreview(previewUrl),
	);
	store.set(
		previewMessageAtom,
		loading
			? 'Loading Steam Workshop details…'
			: 'Steam Workshop details loaded.',
	);
	return store;
}

function PreviewStory(props: PreviewStoryProps) {
	const {
		loading = false,
		previewUrl = storyPreviewUrl,
		narrowPreviewColumn = false,
	} = props;
	const [store] = useState(() =>
		createPreviewStoryStore(loading, previewUrl)
	);
	useEffect(() => {
		if (!loading) return;
		const timeoutId = globalThis.setTimeout(() => {
			store.set(steamPreviewAtom, createSteamPreview(previewUrl));
			store.set(previewMessageAtom, 'Steam Workshop details loaded.');
		}, 1000);
		return () => globalThis.clearTimeout(timeoutId);
	}, [loading, previewUrl, store]);
	const controller: PreviewStoryController = {
		closeModPreview() {
			store.set(selectedModAtom, null);
		},
	};

	return (
		<div
			className={cn(
				'grid h-dvh min-h-0 grid-cols-1 p-6',
				narrowPreviewColumn && 'mx-auto w-72 p-0',
			)}
			data-preview-column-width={narrowPreviewColumn ? 'narrow' : 'full'}
		>
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
	play: async ({ canvasElement }) => {
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
		if (!closeButton) {
			throw new Error('The dialog must expose its Close action.');
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
		const imageSlot = canvasElement.querySelector<HTMLElement>(
			'[aria-label="Loading mod preview image"]',
		);
		if (!card || !imageSlot) {
			throw new Error(
				'The preview must reserve its image slot while loading.',
			);
		}
		if (!imageSlot.querySelector('[data-slot="skeleton"]')) {
			throw new Error(
				'The image slot must show a shadcn Skeleton while loading.',
			);
		}
		assertPreviewDoesNotScroll(card);

		const viewportHeight = canvasElement.ownerDocument.documentElement
			.clientHeight;
		const initialCardHeight = card.getBoundingClientRect().height;
		if (Math.abs(initialCardHeight / viewportHeight - 0.48) > 0.03) {
			throw new Error(
				`The preview must occupy about 48% of the page height; received ${initialCardHeight}px of ${viewportHeight}px.`,
			);
		}
		const initialSlotBounds = imageSlot.getBoundingClientRect();
		if (initialSlotBounds.height === 0) {
			throw new Error('The padded image slot must keep a fixed height.');
		}
		if (initialSlotBounds.height <= viewportHeight * 0.16) {
			throw new Error(
				'The Workshop image area must stay above 16% of the viewport height.',
			);
		}

		const workshopButtons = Array.from(
			canvasElement.querySelectorAll('button'),
		).filter((button) =>
			['Browser', 'Steam'].includes(button.textContent?.trim() ?? '')
		);
		const browserButton = workshopButtons.find((button) =>
			button.textContent?.trim() === 'Browser'
		);
		const steamButton = workshopButtons.find((button) =>
			button.textContent?.trim() === 'Steam'
		);
		if (
			workshopButtons.length !== 2 ||
			!browserButton?.querySelector('svg') ||
			!steamButton?.querySelector('svg')
		) {
			throw new Error(
				'Both Workshop actions must show their icon and label while loading.',
			);
		}
		const initialButtonBounds = workshopButtons.map((button) =>
			button.getBoundingClientRect()
		);
		const initialButtonBottom = Math.max(
			initialButtonBounds[0].bottom,
			initialButtonBounds[1].bottom,
		);
		if (
			card.getBoundingClientRect().bottom - initialButtonBottom >
				viewportHeight * 0.12
		) {
			throw new Error(
				'Workshop actions must stay near the bottom of the preview card.',
			);
		}
		if (initialButtonBounds[0].top !== initialButtonBounds[1].top) {
			throw new Error('Workshop actions must stay on one row.');
		}

		await new Promise<void>((resolve) => setTimeout(resolve, 1100));
		const loadedImage = canvasElement.querySelector<HTMLImageElement>(
			'img[alt="Sample Vehicle Mod Workshop preview"]',
		);
		if (
			!loadedImage || !loadedImage.complete ||
			loadedImage.naturalWidth === 0 || !loadedImage.parentElement
		) {
			throw new Error('The Workshop preview image must load.');
		}
		const loadedImageSlot = loadedImage.parentElement;
		const previewAuthor = Array.from(
			canvasElement.querySelectorAll('p'),
		).find((paragraph) =>
			paragraph.textContent?.trim() === 'Workshop Author'
		);
		const modVersion = canvasElement.querySelector<HTMLElement>(
			'[aria-label="Mod version"]',
		);
		if (
			!previewAuthor ||
			!modVersion ||
			modVersion.textContent?.trim() !== 'Version 2.3.4' ||
			previewAuthor.getBoundingClientRect().right >=
				modVersion.getBoundingClientRect().left
		) {
			throw new Error(
				'About.xml modVersion must display across from the author.',
			);
		}
		if (loadedImageSlot.querySelector('[data-slot="skeleton"]')) {
			throw new Error(
				'The image slot Skeleton must disappear after image load.',
			);
		}
		if (card.getBoundingClientRect().height !== initialCardHeight) {
			throw new Error(
				'The preview height must remain stable after image load.',
			);
		}
		const loadedSlotBounds = loadedImageSlot.getBoundingClientRect();
		if (
			loadedSlotBounds.top !== initialSlotBounds.top ||
			loadedSlotBounds.height !== initialSlotBounds.height
		) {
			throw new Error(
				'The image slot position and size must remain stable.',
			);
		}
		for (const [index, button] of workshopButtons.entries()) {
			const loadedButtonBounds = button.getBoundingClientRect();
			if (
				loadedButtonBounds.top !== initialButtonBounds[index].top ||
				loadedButtonBounds.left !== initialButtonBounds[index].left
			) {
				throw new Error(
					`Workshop action ${button.textContent?.trim()} moved from (${
						initialButtonBounds[index].left
					}, ${
						initialButtonBounds[index].top
					}) to (${loadedButtonBounds.left}, ${loadedButtonBounds.top}).`,
				);
			}
		}
		assertPreviewDoesNotScroll(card);
		if (!canvasElement.textContent?.includes('Workshop Author')) {
			throw new Error(
				'The resolved mod preview must preserve its content.',
			);
		}
	},
};

export const NarrowPreviewColumnKeepsActionsStable: Story = {
	render: () => <PreviewStory loading narrowPreviewColumn />,
	play: LoadingKeepsPreviewHeight.play,
};
export const MissingPreviewImage: Story = {
	render: () => <PreviewStory previewUrl={null} />,
	play: ({ canvasElement }) => {
		const card = canvasElement.querySelector<HTMLElement>(
			'[data-slot="card"]',
		);
		const imageSlot = canvasElement.querySelector<HTMLElement>(
			'[data-slot="mod-preview-image"]',
		);
		if (!card || !imageSlot) {
			throw new Error('The preview must reserve its image slot.');
		}
		if (
			imageSlot.querySelector('[data-slot="skeleton"]') ||
			imageSlot.querySelector('img')
		) {
			throw new Error(
				'A missing preview image must not leave an image Skeleton.',
			);
		}
		if (imageSlot.getBoundingClientRect().height === 0) {
			throw new Error(
				'The image slot must remain reserved without an image.',
			);
		}
		if (
			Array.from(canvasElement.querySelectorAll('button')).filter(
				(button) =>
					['Browser', 'Steam'].includes(
						button.textContent?.trim() ?? '',
					),
			).length !== 2
		) {
			throw new Error(
				'Workshop actions must remain available without an image.',
			);
		}
		assertPreviewDoesNotScroll(card);
	},
};

export const FailedPreviewImageClearsSkeleton: Story = {
	render: () => <PreviewStory previewUrl='data:image/png;base64,invalid' />,
	play: async ({ canvasElement }) => {
		const document = canvasElement.ownerDocument;
		const imageSlot = document.querySelector<HTMLElement>(
			'[data-slot="mod-preview-image"]',
		);
		const image = imageSlot?.querySelector<HTMLImageElement>('img');
		if (!imageSlot || !image) {
			throw new Error('The invalid preview image must be rendered.');
		}
		const initialSlotHeight = imageSlot.getBoundingClientRect().height;
		let failedImage: HTMLImageElement | null = null;
		for (let attempt = 0; attempt < 20; attempt += 1) {
			failedImage = document.querySelector<HTMLImageElement>(
				'img[alt="Sample Vehicle Mod Workshop preview"]',
			);
			if (failedImage?.complete && failedImage.naturalWidth === 0) break;
			await new Promise<void>((resolve) => setTimeout(resolve, 25));
		}
		if (!failedImage?.complete || failedImage.naturalWidth !== 0) {
			throw new Error('The invalid preview image must fail to load.');
		}
		let failedImageSlot: HTMLElement | null = null;
		for (let attempt = 0; attempt < 20; attempt += 1) {
			failedImageSlot = document.querySelector<HTMLElement>(
				'[data-slot="mod-preview-image"]',
			);
			if (
				failedImageSlot &&
				!failedImageSlot.querySelector('[data-slot="skeleton"]')
			) {
				break;
			}
			await new Promise<void>((resolve) => setTimeout(resolve, 25));
		}
		if (!failedImageSlot) {
			throw new Error('The failed image slot must remain rendered.');
		}
		if (failedImageSlot.querySelector('[data-slot="skeleton"]')) {
			throw new Error('The image Skeleton must clear after image error.');
		}
		if (
			failedImageSlot.getBoundingClientRect().height !== initialSlotHeight
		) {
			throw new Error(
				'The image slot must remain reserved after image error.',
			);
		}
	},
};
