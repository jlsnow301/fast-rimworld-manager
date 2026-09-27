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
		<header className='app-header'>
			<div>
				<h1>RimSort</h1>
				<span>RimWorld mod manager</span>
			</div>
			<div className='header-status'>
				<span>{sourceName || 'No mod list loaded'}</span>
				{isModListDirty && (
					<span aria-live='polite' className='dirty-indicator'>
						Unsaved changes
					</span>
				)}
				<button onClick={() => fileInput.current?.click()}>
					Import list
				</button>
				<button disabled={!hasModList} onClick={saveModList}>
					Save to RimWorld
				</button>
				<button aria-expanded={settingsOpen} onClick={toggleSettings}>
					{settingsOpen ? 'Back' : 'Settings'}
				</button>
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
