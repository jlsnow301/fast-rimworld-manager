import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { createStore, Provider } from 'jotai';
import { AppProvider } from '@/context/app-context';
import {
	activeModsAtom,
	installedGameVersionAtom,
	installedModsAtom,
} from '@/features/mod-list/atoms';
import {
	selectedModAtom,
	steamPreviewAtom,
} from '@/features/mod-preview/atoms';
import { ModPreviewFeature } from '@/features/mod-preview/mod-preview-feature';
import type { AppController } from '@/hooks/use-app-controller';
import type { InstalledMod } from '@/utils/types';

const meta = {
	title: 'Mod Preview/Installed Details',
	component: ModPreviewFeature,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof ModPreviewFeature>;

export default meta;
type Story = StoryObj<typeof meta>;
type StoryStore = ReturnType<typeof createStore>;
type PreviewStoryController = Pick<AppController, 'closeModPreview'>;

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

function createPreviewStoryStore(): StoryStore {
	const store = createStore();
	store.set(installedModsAtom, [previewMod]);
	store.set(activeModsAtom, [previewMod.packageId]);
	store.set(installedGameVersionAtom, '1.6');
	store.set(selectedModAtom, previewMod);
	store.set(steamPreviewAtom, {
		publishedFileId: '123456789',
		title: previewMod.name,
		description: 'Sample Workshop description.',
		previewUrl:
			'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
		timeUpdated: 1722470400,
	});
	return store;
}

function PreviewStory() {
	const [store] = useState(createPreviewStoryStore);
	const controller: PreviewStoryController = {
		closeModPreview() {
			store.set(selectedModAtom, null);
		},
	};

	return (
		<Provider store={store}>
			<AppProvider value={controller as AppController}>
				<ModPreviewFeature />
			</AppProvider>
		</Provider>
	);
}

export const InfoShowsOnDiskDetails: Story = {
	render: () => <PreviewStory />,
	play: async ({ canvasElement }) => {
		const document = canvasElement.ownerDocument;
		const infoButton = Array.from(canvasElement.querySelectorAll('button'))
			.find((button) => button.textContent?.trim() === 'Info');
		if (!infoButton) throw new Error('The Info action must be available.');
		infoButton.click();
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
		closeButton.click();
		await new Promise<void>((resolve) => setTimeout(resolve, 200));
		const closedDialog = document.querySelector('[role="dialog"]');
		if (closedDialog && getComputedStyle(closedDialog).display !== 'none') {
			throw new Error(
				'The dialog must close from its primary Close action.',
			);
		}
	},
};
