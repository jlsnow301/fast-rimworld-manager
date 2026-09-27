import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';
import { useAppContext } from '../../context/app-context';
export function AppHeader() {
	const fileInput = useRef<HTMLInputElement>(null);
	const {
		hasModList,
		isModListDirty,
		importModList,
		settingsOpen,
		sourceName,
		toggleSettings,
		saveModList,
	} = useAppContext();

	return (
		<header className='flex items-center justify-between gap-4 border-b px-5 py-3'>
			<div className='grid gap-0.5'>
				<h1 className='text-lg font-semibold tracking-wide'>RimSort</h1>
				<span className='text-sm text-muted-foreground'>
					RimWorld mod manager
				</span>
			</div>
			<div className='flex items-center gap-2'>
				<Badge variant='outline'>{sourceName || 'No mod list loaded'}</Badge>
				{isModListDirty && (
					<Badge variant='secondary' aria-live='polite'>Unsaved changes</Badge>
				)}
				<Button
					variant='outline'
					size='sm'
					onClick={() => fileInput.current?.click()}
				>
					Import list
				</Button>
				<Button
					variant='outline'
					size='sm'
					disabled={!hasModList}
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
				<input
					ref={fileInput}
					aria-label='Import RimWorld ModsConfig.xml'
					accept='.xml'
					hidden
					onChange={(event) => {
						void importModList(event.currentTarget.files?.[0] ?? null);
						event.currentTarget.value = '';
					}}
					type='file'
				/>
			</div>
		</header>
	);
}
