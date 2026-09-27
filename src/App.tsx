import { type FormEvent, useRef, useState } from 'react';
import './App.css';

type ModListFile = {
	activeMods: string[];
	knownExpansions: string[];
	version: string;
};

function escapeXml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function parseModsConfig(content: string): ModListFile {
	const document = new DOMParser().parseFromString(content, 'application/xml');
	const root = document.querySelector('ModsConfigData');

	if (document.querySelector('parsererror') || !root) {
		throw new Error('This file is not a valid RimWorld ModsConfig.xml file.');
	}

	const activeMods = Array.from(root.querySelectorAll('activeMods > li'))
		.map((entry) => entry.textContent?.trim() ?? '')
		.filter(Boolean);
	const knownExpansions = Array.from(
		root.querySelectorAll('knownExpansions > li'),
	)
		.map((entry) => entry.textContent?.trim() ?? '')
		.filter(Boolean);

	return {
		activeMods,
		knownExpansions,
		version: root.querySelector('version')?.textContent?.trim() || '1.4',
	};
}

function App() {
	const fileInput = useRef<HTMLInputElement>(null);
	const [activeMods, setActiveMods] = useState<string[]>([]);
	const [inactiveMods, setInactiveMods] = useState<string[]>([]);
	const [knownExpansions, setKnownExpansions] = useState<string[]>([]);
	const [gameVersion, setGameVersion] = useState('1.4');
	const [sourceName, setSourceName] = useState('');
	const [activeSearch, setActiveSearch] = useState('');
	const [inactiveSearch, setInactiveSearch] = useState('');
	const [newPackageId, setNewPackageId] = useState('');
	const [status, setStatus] = useState(
		'Import a ModsConfig.xml file or add a package ID to start editing.',
	);

	const hasModList = sourceName.length > 0 || activeMods.length > 0 ||
		inactiveMods.length > 0;

	async function importModList(event: FormEvent<HTMLInputElement>) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';

		if (!file) return;

		try {
			const parsed = parseModsConfig(await file.text());
			setActiveMods(parsed.activeMods);
			setInactiveMods([]);
			setKnownExpansions(parsed.knownExpansions);
			setGameVersion(parsed.version);
			setSourceName(file.name);
			setStatus(
				`Loaded ${parsed.activeMods.length} active mods from ${file.name}.`,
			);
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: 'Could not read this mod list.',
			);
		}
	}

	function addMod(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const packageId = newPackageId.trim();

		if (!packageId) return;

		const alreadyExists = [...activeMods, ...inactiveMods].some(
			(mod) => mod.toLowerCase() === packageId.toLowerCase(),
		);

		if (alreadyExists) {
			setStatus(`${packageId} is already in this list.`);
			return;
		}

		setActiveMods((mods) => [...mods, packageId]);
		setNewPackageId('');
		setStatus(`Added ${packageId} to the active list.`);
	}

	function moveMod(index: number, source: 'active' | 'inactive') {
		if (source === 'active') {
			const mod = activeMods[index];
			if (!mod) return;
			setActiveMods((mods) => mods.filter((_, modIndex) => modIndex !== index));
			setInactiveMods((mods) => [...mods, mod]);
			setStatus(`Moved ${mod} to inactive mods.`);
			return;
		}

		const mod = inactiveMods[index];
		if (!mod) return;
		setInactiveMods((mods) => mods.filter((_, modIndex) => modIndex !== index));
		setActiveMods((mods) => [...mods, mod]);
		setStatus(`Moved ${mod} to active mods.`);
	}

	function moveActiveMod(index: number, direction: -1 | 1) {
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= activeMods.length) return;

		setActiveMods((mods) => {
			const reordered = [...mods];
			[reordered[index], reordered[targetIndex]] = [
				reordered[targetIndex],
				reordered[index],
			];
			return reordered;
		});
	}

	function saveModList() {
		const xml = [
			'<?xml version="1.0" encoding="utf-8"?>',
			'<ModsConfigData>',
			`  <version>${escapeXml(gameVersion)}</version>`,
			'  <activeMods>',
			...activeMods.map((mod) => `    <li>${escapeXml(mod)}</li>`),
			'  </activeMods>',
			'  <knownExpansions>',
			...knownExpansions.map((expansion) =>
				`    <li>${escapeXml(expansion)}</li>`
			),
			'  </knownExpansions>',
			'</ModsConfigData>',
		].join('\n');
		const downloadUrl = URL.createObjectURL(
			new Blob([xml], { type: 'application/xml' }),
		);
		const download = document.createElement('a');
		download.href = downloadUrl;
		download.download = 'ModsConfig.xml';
		download.click();
		window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
		setStatus('Downloaded ModsConfig.xml.');
	}

	const visibleActiveMods = activeMods
		.map((packageId, index) => ({ packageId, index }))
		.filter(({ packageId }) =>
			packageId.toLowerCase().includes(activeSearch.toLowerCase())
		);
	const visibleInactiveMods = inactiveMods
		.map((packageId, index) => ({ packageId, index }))
		.filter(({ packageId }) =>
			packageId.toLowerCase().includes(inactiveSearch.toLowerCase())
		);

	return (
		<main className='app-shell'>
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
					<button disabled={!hasModList} onClick={saveModList}>Save XML</button>
					<input
						ref={fileInput}
						aria-label='Import RimWorld ModsConfig.xml'
						accept='.xml'
						hidden
						onChange={importModList}
						type='file'
					/>
				</div>
			</header>

			<section className='content'>
				<div className='page-heading'>
					<div>
						<h2>Mod list</h2>
						<p>Game version {gameVersion}</p>
					</div>
					<span>
						{activeMods.length} active · {inactiveMods.length} inactive
					</span>
				</div>

				<form className='add-mod-form' onSubmit={addMod}>
					<label htmlFor='package-id'>Add package ID</label>
					<input
						autoComplete='off'
						id='package-id'
						onChange={(event) => setNewPackageId(event.currentTarget.value)}
						placeholder='Author.ModName'
						value={newPackageId}
					/>
					<button type='submit'>Add to active</button>
				</form>

				<div className='mod-columns'>
					<ModListPanel
						count={activeMods.length}
						emptyMessage={hasModList
							? 'No active mods.'
							: 'Import a mod list to see active mods.'}
						mods={visibleActiveMods}
						onMove={moveMod}
						onReorder={moveActiveMod}
						onSearch={setActiveSearch}
						search={activeSearch}
						title='Active mods'
						type='active'
					/>
					<ModListPanel
						count={inactiveMods.length}
						emptyMessage='Mods you deactivate will appear here.'
						mods={visibleInactiveMods}
						onMove={moveMod}
						onSearch={setInactiveSearch}
						search={inactiveSearch}
						title='Inactive mods'
						type='inactive'
					/>
				</div>

				<p aria-live='polite' className='status-message'>{status}</p>
			</section>
		</main>
	);
}

type ModListPanelProps = {
	count: number;
	emptyMessage: string;
	mods: { packageId: string; index: number }[];
	onMove: (index: number, source: 'active' | 'inactive') => void;
	onReorder?: (index: number, direction: -1 | 1) => void;
	onSearch: (query: string) => void;
	search: string;
	title: string;
	type: 'active' | 'inactive';
};

function ModListPanel({
	count,
	emptyMessage,
	mods,
	onMove,
	onReorder,
	onSearch,
	search,
	title,
	type,
}: ModListPanelProps) {
	return (
		<section className='mod-panel'>
			<div className='panel-heading'>
				<h3>{title}</h3>
				<span>{count}</span>
			</div>
			<input
				aria-label={`Search ${title.toLowerCase()}`}
				onChange={(event) => onSearch(event.currentTarget.value)}
				placeholder='Search package IDs'
				value={search}
			/>
			<div className='mod-list'>
				{mods.length === 0
					? (
						<p className='empty-message'>
							{count > 0 ? 'No matches.' : emptyMessage}
						</p>
					)
					: mods.map(({ packageId, index }) => (
						<div className='mod-row' key={`${packageId}-${index}`}>
							<span className='package-id'>{packageId}</span>
							<div className='row-actions'>
								{type === 'active' && onReorder && (
									<>
										<button
											aria-label={`Move ${packageId} up`}
											disabled={index === 0}
											onClick={() => onReorder(index, -1)}
										>
											↑
										</button>
										<button
											aria-label={`Move ${packageId} down`}
											disabled={index === count - 1}
											onClick={() =>
												onReorder(index, 1)}
										>
											↓
										</button>
									</>
								)}
								<button
									onClick={() =>
										onMove(index, type)}
								>
									{type === 'active' ? 'Deactivate' : 'Activate'}
								</button>
							</div>
						</div>
					))}
			</div>
		</section>
	);
}

export default App;
