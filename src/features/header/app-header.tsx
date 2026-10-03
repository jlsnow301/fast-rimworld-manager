import { useAtomValue } from 'jotai';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	hasModListAtom,
	isModListDirtyAtom,
	isTestModeAtom,
	modListLoadStateAtom,
	sourceNameAtom,
} from '@/features/mod-list/atoms';
import { settingsOpenAtom } from '@/features/settings/atoms';
import { useAppContext } from '@/context/app-context';

export function AppHeader() {
	const {
		importModList,
		toggleSettings,
		saveModList,
	} = useAppContext();
	const hasModList = useAtomValue(hasModListAtom);
	const modListLoadState = useAtomValue(modListLoadStateAtom);
	const isModListDirty = useAtomValue(isModListDirtyAtom);
	const isTestMode = useAtomValue(isTestModeAtom);
	const settingsOpen = useAtomValue(settingsOpenAtom);
	const sourceName = useAtomValue(sourceNameAtom);
	const visibleSourceName = sourceName === 'ModsConfig.xml' ? '' : sourceName;

	return (
		<header className='flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3'>
			<div>
				<h1 className='text-lg font-semibold tracking-wide'>
					Fast RimWorld Manager
				</h1>
			</div>
			<div className='flex max-w-full flex-wrap items-center justify-end gap-2'>
				{(visibleSourceName || modListLoadState === 'loading' ||
					modListLoadState === 'failed' || !hasModList) && (
					<Badge
						aria-live='polite'
						className='max-w-48 truncate'
						variant='outline'
					>
						{visibleSourceName || (modListLoadState === 'loading'
							? 'Loading mod list…'
							: modListLoadState === 'failed'
							? 'Mod list failed to load'
							: 'No mod list loaded')}
					</Badge>
				)}
				{isTestMode && <Badge variant='secondary'>TEST MODE</Badge>}
				{isModListDirty && (
					<Badge variant='secondary' aria-live='polite'>
						Unsaved changes
					</Badge>
				)}
				<Button
					variant='outline'
					size='sm'
					disabled={isTestMode}
					onClick={importModList}
				>
					Import list
				</Button>
				<Button
					variant={isModListDirty ? 'default' : 'outline'}
					size='sm'
					disabled={!hasModList || isTestMode}
					onClick={saveModList}
				>
					Save to RimWorld
				</Button>
				<Button
					variant='outline'
					size='sm'
					aria-expanded={settingsOpen}
					onClick={toggleSettings}
				>
					{settingsOpen ? 'Back' : 'Settings'}
				</Button>
			</div>
		</header>
	);
}
