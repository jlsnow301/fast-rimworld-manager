import { useAtomValue, useSetAtom } from 'jotai';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	hasModListAtom,
	isModListDirtyAtom,
	isTestModeAtom,
	settingsOpenAtom,
	sourceNameAtom,
	toggleTestModeAtom,
} from '../../state/app-atoms';
import { useAppContext } from '../../context/app-context';
export function AppHeader() {
	const {
		importModList,
		toggleSettings,
		saveModList,
	} = useAppContext();
	const hasModList = useAtomValue(hasModListAtom);
	const isModListDirty = useAtomValue(isModListDirtyAtom);
	const isTestMode = useAtomValue(isTestModeAtom);
	const settingsOpen = useAtomValue(settingsOpenAtom);
	const sourceName = useAtomValue(sourceNameAtom);
	const toggleTestMode = useSetAtom(toggleTestModeAtom);

	return (
		<header className='flex items-center justify-between gap-4 border-b px-5 py-3'>
			<div className='grid gap-0.5'>
				<h1 className='text-lg font-semibold tracking-wide'>
					Fast RimWorld Manager
				</h1>
				<span className='text-sm text-muted-foreground'>
					Manage RimWorld mods
				</span>
			</div>
			<div className='flex items-center gap-2'>
				<Badge variant='outline'>
					{sourceName || 'No mod list loaded'}
				</Badge>
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
					variant='outline'
					size='sm'
					disabled={!hasModList || isTestMode}
					onClick={saveModList}
				>
					Save to RimWorld
				</Button>
				<Button
					variant={isTestMode ? 'secondary' : 'outline'}
					size='sm'
					aria-pressed={isTestMode}
					onClick={() => toggleTestMode()}
				>
					{isTestMode ? 'Exit test mode' : 'Load sample list'}
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
