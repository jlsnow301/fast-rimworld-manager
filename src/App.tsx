import { invoke } from '@tauri-apps/api/core';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import './App.css';
import { moveModBetweenLists } from './mod_lists';
type PathSettings = {
	gamePath: string;
	configPath: string;
	localModsPath: string;
	workshopPath: string;
};

type DetectedPaths = {
	gamePath: string | null;
	configPath: string | null;
	localModsPath: string | null;
	workshopPath: string | null;
};

type InstalledMod = {
	name: string;
	packageId: string;
	path: string;
	source: string;
};

function normalizedPackageId(packageId: string) {
	return packageId.toLowerCase().replace(/_steam$/, '');
}

function getInactivePackageIds(
	installedMods: InstalledMod[],
	activeMods: string[],
) {
	const activeIds = new Set(activeMods.map(normalizedPackageId));
	const seenIds = new Set<string>();
	const inactiveMods: string[] = [];

	for (const mod of installedMods) {
		const packageId = normalizedPackageId(mod.packageId);
		if (!packageId || activeIds.has(packageId) || seenIds.has(packageId)) {
			continue;
		}
		seenIds.add(packageId);
		inactiveMods.push(mod.packageId);
	}

	return inactiveMods;
}

const EMPTY_PATH_SETTINGS: PathSettings = {
	gamePath: '',
	configPath: '',
	localModsPath: '',
	workshopPath: '',
};

const PATH_FIELDS: { key: keyof PathSettings; label: string }[] = [
	{ key: 'gamePath', label: 'RimWorld game folder' },
	{ key: 'configPath', label: 'RimWorld config folder' },
	{ key: 'localModsPath', label: 'Local mods folder' },
	{ key: 'workshopPath', label: 'Steam Workshop mods folder' },
];

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
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [pathSettings, setPathSettings] = useState<PathSettings>(
		EMPTY_PATH_SETTINGS,
	);
	const [settingsMessage, setSettingsMessage] = useState(
		'Loading saved paths.',
	);
	const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
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

	useEffect(() => {
		let cancelled = false;

		async function loadConfiguredMods() {
			let settings: PathSettings;
			try {
				settings = await invoke<PathSettings>('load_path_settings');
			} catch {
				if (!cancelled) {
					setSettingsMessage(
						'Path settings are available in the desktop app.',
					);
				}
				return;
			}

			if (cancelled) return;
			setPathSettings(settings);
			setSettingsMessage('Saved paths loaded.');

			const [modsResult, configResult] = await Promise.allSettled([
				invoke<InstalledMod[]>('list_installed_mods'),
				settings.configPath
					? invoke<string | null>('load_startup_mod_list')
					: Promise.resolve(null),
			]);
			if (cancelled) return;

			const foundMods = modsResult.status === 'fulfilled'
				? modsResult.value
				: [];
			const content = configResult.status === 'fulfilled'
				? configResult.value
				: null;
			setInstalledMods(foundMods);
			setActiveMods([]);
			setInactiveMods(getInactivePackageIds(foundMods, []));

			if (content) {
				try {
					const parsed = parseModsConfig(content);
					setActiveMods(parsed.activeMods);
					setInactiveMods(
						getInactivePackageIds(foundMods, parsed.activeMods),
					);
					setKnownExpansions(parsed.knownExpansions);
					setGameVersion(parsed.version);
					setSourceName('ModsConfig.xml');
					setStatus(
						`Loaded ${parsed.activeMods.length} active mods and found ${foundMods.length} installed mods.`,
					);
				} catch (error) {
					setStatus(
						error instanceof Error ? error.message : String(error),
					);
				}
				return;
			}

			if (configResult.status === 'rejected') {
				setStatus(String(configResult.reason));
			} else if (settings.configPath) {
				setStatus(
					`No ModsConfig.xml found. Found ${foundMods.length} installed mods.`,
				);
			} else if (modsResult.status === 'rejected') {
				setStatus(String(modsResult.reason));
			} else if (foundMods.length > 0) {
				setStatus(`Found ${foundMods.length} installed mods.`);
			}
		}

		void loadConfiguredMods();
		return () => {
			cancelled = true;
		};
	}, []);

	const hasModList = sourceName.length > 0 || activeMods.length > 0 ||
		inactiveMods.length > 0;

	async function importModList(event: FormEvent<HTMLInputElement>) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';

		if (!file) return;

		try {
			const parsed = parseModsConfig(await file.text());
			setActiveMods(parsed.activeMods);
			setInactiveMods(getInactivePackageIds(installedMods, parsed.activeMods));
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
		const transfer = moveModBetweenLists(
			activeMods,
			inactiveMods,
			index,
			source,
		);
		if (!transfer) return;

		setActiveMods(transfer.active);
		setInactiveMods(transfer.inactive);
		setStatus(
			`Moved ${transfer.packageId} to ${
				source === 'active' ? 'inactive' : 'active'
			} mods.`,
		);
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

	function updatePath(key: keyof PathSettings, value: string) {
		setPathSettings((settings) => ({ ...settings, [key]: value }));
	}

	async function autoDetectPaths() {
		setSettingsMessage('Looking for RimWorld and Steam folders…');
		try {
			const detected = await invoke<DetectedPaths>('detect_rimworld_paths');
			const updates: Partial<PathSettings> = {};
			for (const key of Object.keys(detected) as (keyof PathSettings)[]) {
				const detectedPath = detected[key];
				if (detectedPath && !pathSettings[key]) {
					updates[key] = detectedPath;
				}
			}
			setPathSettings((settings) => ({ ...settings, ...updates }));
			const foundCount = Object.keys(updates).length;
			setSettingsMessage(
				foundCount
					? `Detected ${foundCount} path${
						foundCount === 1 ? '' : 's'
					}. Review and save them.`
					: 'No RimWorld paths found. Enter paths manually.',
			);
		} catch (error) {
			setSettingsMessage(
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	async function savePathSettings() {
		setSettingsMessage('Saving paths…');
		try {
			await invoke('save_path_settings', { settings: pathSettings });
			setSettingsMessage('Paths saved.');
		} catch (error) {
			setSettingsMessage(
				error instanceof Error ? error.message : String(error),
			);
			return;
		}

		try {
			const foundMods = await invoke<InstalledMod[]>('list_installed_mods');
			setInstalledMods(foundMods);
			setInactiveMods(getInactivePackageIds(foundMods, activeMods));
			setStatus(`Found ${foundMods.length} installed mods.`);
		} catch (error) {
			setSettingsMessage(
				`Paths saved, but mod scanning failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
	const modDetailsByPackageId = new Map<string, InstalledMod>();
	for (const mod of installedMods) {
		const key = normalizedPackageId(mod.packageId);
		if (!modDetailsByPackageId.has(key)) modDetailsByPackageId.set(key, mod);
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
					<button
						aria-expanded={settingsOpen}
						onClick={() => setSettingsOpen((open) => !open)}
					>
						{settingsOpen ? 'Back' : 'Settings'}
					</button>
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

			{settingsOpen && (
				<SettingsPanel
					message={settingsMessage}
					onAutoDetect={autoDetectPaths}
					onSave={savePathSettings}
					onUpdate={updatePath}
					paths={pathSettings}
				/>
			)}
			<section className='content' hidden={settingsOpen}>
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
						modDetailsByPackageId={modDetailsByPackageId}
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
						modDetailsByPackageId={modDetailsByPackageId}
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

type SettingsPanelProps = {
	message: string;
	onAutoDetect: () => void;
	onSave: () => void;
	onUpdate: (key: keyof PathSettings, value: string) => void;
	paths: PathSettings;
};

function SettingsPanel({
	message,
	onAutoDetect,
	onSave,
	onUpdate,
	paths,
}: SettingsPanelProps) {
	return (
		<section className='content settings-panel'>
			<div className='page-heading'>
				<div>
					<h2>Settings</h2>
					<p>RimWorld and mod folder locations</p>
				</div>
			</div>
			<div className='settings-actions'>
				<button onClick={onAutoDetect}>Auto-detect paths</button>
				<button onClick={onSave}>Save paths</button>
			</div>
			<div className='path-fields'>
				{PATH_FIELDS.map(({ key, label }) => (
					<label className='path-field' htmlFor={`path-${key}`} key={key}>
						<span>{label}</span>
						<input
							autoComplete='off'
							id={`path-${key}`}
							onChange={(event) =>
								onUpdate(key, event.currentTarget.value)}
							placeholder='Enter folder path'
							spellCheck={false}
							value={paths[key]}
						/>
					</label>
				))}
			</div>
			<p aria-live='polite' className='status-message'>{message}</p>
		</section>
	);
}

type ModListPanelProps = {
	count: number;
	emptyMessage: string;
	modDetailsByPackageId: ReadonlyMap<string, InstalledMod>;
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
	modDetailsByPackageId,
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
					: mods.map(({ packageId, index }) => {
						const mod = modDetailsByPackageId.get(
							normalizedPackageId(packageId),
						);
						return (
							<div className='mod-row' key={`${packageId}-${index}`}>
								<div className='mod-labels'>
									<span className='mod-name'>{mod?.name ?? packageId}</span>
									{mod && (
										<span className='package-id'>
											{mod.packageId} · {mod.source}
										</span>
									)}
								</div>
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
												onClick={() => onReorder(index, 1)}
											>
												↓
											</button>
										</>
									)}
									<button onClick={() => onMove(index, type)}>
										{type === 'active' ? 'Deactivate' : 'Activate'}
									</button>
								</div>
							</div>
						);
					})}
			</div>
		</section>
	);
}

export default App;
