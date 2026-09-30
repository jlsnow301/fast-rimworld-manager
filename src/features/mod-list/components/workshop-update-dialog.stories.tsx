import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { createStore, Provider } from 'jotai';
import { Button } from '@/components/ui/button';
import { AppProvider } from '@/context/app-context';
import {
	isTestModeAtom,
	workshopUpdateResultAtom,
} from '@/features/mod-list/atoms';
import { WorkshopUpdateDialog } from '@/features/mod-list/components/workshop-update-dialog';
import type { AppController } from '@/hooks/use-app-controller';
import type { OutdatedWorkshopMod } from '@/utils/types';

const meta = {
	title: 'Mod Lists/Workshop Update Dialog',
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;
type StoryStore = ReturnType<typeof createStore>;
type WorkshopUpdateStoryController = Pick<
	AppController,
	'updateSelectedOutdatedWorkshopMods'
>;

const outdatedMods: OutdatedWorkshopMod[] = [
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
		installedTimeUpdated: 1711929600,
		steamTimeUpdated: 1722816000,
	},
	{
		name: 'HugsLib',
		packageId: 'unlimitedhugs.hugslib',
		publishedFileId: '818773962',
		installedTimeUpdated: 1709251200,
		steamTimeUpdated: 1722729600,
	},
];

function createWorkshopUpdateStoryStore(): StoryStore {
	const store = createStore();
	store.set(isTestModeAtom, false);
	store.set(workshopUpdateResultAtom, {
		checkedCount: 12,
		skippedCount: 2,
		outdatedMods,
	});
	return store;
}

function WorkshopUpdateStory() {
	const [store] = useState(createWorkshopUpdateStoryStore);
	const [open, setOpen] = useState(true);
	const [selectedIds, setSelectedIds] = useState(
		() => outdatedMods.map((mod) => mod.publishedFileId),
	);
	const [dispatchMessage, setDispatchMessage] = useState(
		'All detected updates are selected. Adjust the selection before sending.',
	);
	const controller: WorkshopUpdateStoryController = {
		updateSelectedOutdatedWorkshopMods(mods) {
			setDispatchMessage(
				`Storybook preview queued update requests for ${
					mods.map((mod) => mod.name).join(', ')
				}.`,
			);
			return Promise.resolve({
				openedCount: mods.length,
				failedCount: 0,
			});
		},
	};

	return (
		<Provider store={store}>
			<AppProvider value={controller as AppController}>
				<div className='min-h-12'>
					<p className='mb-3 text-sm text-muted-foreground'>
						{dispatchMessage}
					</p>
					<Button onClick={() => setOpen(true)} variant='outline'>
						Review Workshop updates
					</Button>
					<WorkshopUpdateDialog
						onOpenChange={setOpen}
						onSelectionChange={setSelectedIds}
						open={open}
						selectedIds={selectedIds}
					/>
				</div>
			</AppProvider>
		</Provider>
	);
}

export const SelectUpdates: Story = {
	render: () => <WorkshopUpdateStory />,
};
