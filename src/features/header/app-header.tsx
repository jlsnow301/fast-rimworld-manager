import { useRef } from 'react';
import { useAppContext } from '../../context/app-context';

export function AppHeader() {
	const fileInput = useRef<HTMLInputElement>(null);
	const {
		hasModList,
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
				<button onClick={() => fileInput.current?.click()}>
					Import list
				</button>
				<button disabled={!hasModList} onClick={saveModList}>
					Save XML
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
