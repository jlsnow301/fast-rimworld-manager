import { invoke } from '@tauri-apps/api/core';
import {
	type DragEvent as ReactDragEvent,
	type FormEvent,
	useEffect,
	useRef,
	useState,
} from 'react';
import './App.css';
import { moveModBetweenLists } from './mod_lists';

const TAURI_RUNTIME_REQUIRED =
	'Native RimWorld access requires the Tauri desktop app. Run `deno task tauri dev`.';
function invokeDesktop<T>(command: string, args?: Record<string, unknown>) {
	const internals = (
		window as Window & {
			__TAURI_INTERNALS__?: { invoke?: unknown };
		}
	).__TAURI_INTERNALS__;
	if (typeof internals?.invoke !== 'function') {
		return Promise.reject(new Error(TAURI_RUNTIME_REQUIRED));
	}
	return invoke<T>(command, args);
}

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
	description: string;
	publishedFileId: string | null;
	path: string;
	source: string;
};

type SteamModPreview = {
	publishedFileId: string;
	title: string;
	description: string;
	previewUrl: string | null;
	timeUpdated: number | null;
};

type ModListType = 'active' | 'inactive';

type ModDragPayload = {
	index: number;
	source: ModListType;
};

const MOD_DRAG_MIME = 'application/x-rimsort-mod';

function parseModDragPayload(value: string): ModDragPayload | null {
	try {
		const payload: unknown = JSON.parse(value);
		if (typeof payload !== 'object' || payload === null) return null;
		const candidate = payload as Record<string, unknown>;
		if (
			typeof candidate.index !== 'number' ||
			!Number.isInteger(candidate.index) ||
			(candidate.source !== 'active' && candidate.source !== 'inactive')
		) {
			return null;
		}
		return { index: candidate.index, source: candidate.source };
	} catch {
		return null;
	}
}

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
	const [status, setStatus] = useState(
		'Waiting for configured mods. Set the RimWorld paths in Settings.',
	);
	const [selectedMod, setSelectedMod] = useState<InstalledMod | null>(null);
	const [steamPreview, setSteamPreview] = useState<SteamModPreview | null>(
		null,
	);
	const [previewMessage, setPreviewMessage] = useState('');

	useEffect(() => {
		let cancelled = false;

		async function loadConfiguredMods() {
			let settings: PathSettings;
			try {
				settings = await invokeDesktop<PathSettings>('load_path_settings');
			} catch (error) {
				if (!cancelled) {
					setSettingsMessage(
						error instanceof Error ? error.message : String(error),
					);
				}
				return;
			}

			if (cancelled) return;
			setPathSettings(settings);
			setSettingsMessage('Saved paths loaded.');

			const [modsResult, configResult] = await Promise.allSettled([
				invokeDesktop<InstalledMod[]>('list_installed_mods'),
				settings.configPath
					? invokeDesktop<string | null>('load_startup_mod_list')
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
	useEffect(() => {
		if (!selectedMod) return;

		let cancelled = false;
		setSteamPreview(null);
		if (!selectedMod.publishedFileId) {
			setPreviewMessage('This mod does not include a Steam Workshop ID.');
			return () => {
				cancelled = true;
			};
		}

		setPreviewMessage('Loading Steam Workshop details…');
		void invokeDesktop<SteamModPreview | null>('fetch_steam_mod_details', {
			publishedFileId: selectedMod.publishedFileId,
		})
			.then((preview) => {
				if (cancelled) return;
				setSteamPreview(preview);
				setPreviewMessage(
					preview
						? 'Steam Workshop details loaded.'
						: 'Steam item is unavailable.',
				);
			})
			.catch((error) => {
				if (cancelled) return;
				setPreviewMessage(
					error instanceof Error ? error.message : String(error),
				);
			});

		return () => {
			cancelled = true;
		};
	}, [selectedMod]);

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
	function openModPreview(packageId: string) {
		const mod = modDetailsByPackageId.get(normalizedPackageId(packageId));
		if (!mod) return;
		setSelectedMod(mod);
	}

	function moveMod(
		index: number,
		source: ModListType,
		target: ModListType,
	) {
		if (source === target) return;

		const transfer = moveModBetweenLists(
			activeMods,
			inactiveMods,
			index,
			source,
		);
		if (!transfer) return;

		setActiveMods(transfer.active);
		setInactiveMods(transfer.inactive);
		setStatus(`Moved ${transfer.packageId} to ${target} mods.`);
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
			const detected = await invokeDesktop<DetectedPaths>(
				'detect_rimworld_paths',
			);
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
			await invokeDesktop('save_path_settings', { settings: pathSettings });
			setSettingsMessage('Paths saved.');
		} catch (error) {
			setSettingsMessage(
				error instanceof Error ? error.message : String(error),
			);
			return;
		}

		try {
			const foundMods = await invokeDesktop<InstalledMod[]>(
				'list_installed_mods',
			);
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
				<p className='mod-drag-hint'>
					Drag mods between the lists to change activation.
				</p>

				<div className='mod-columns'>
					<ModListPanel
						count={activeMods.length}
						emptyMessage={hasModList
							? 'No active mods.'
							: 'Import a mod list to see active mods.'}
						mods={visibleActiveMods}
						modDetailsByPackageId={modDetailsByPackageId}
						onDropMod={moveMod}
						onSelectMod={openModPreview}
						onSearch={setActiveSearch}
						search={activeSearch}
						title='Active mods'
						type='active'
					/>
					<ModListPanel
						count={inactiveMods.length}
						emptyMessage='No inactive mods found. Configure paths in Settings.'
						mods={visibleInactiveMods}
						modDetailsByPackageId={modDetailsByPackageId}
						onDropMod={moveMod}
						onSelectMod={openModPreview}
						onSearch={setInactiveSearch}
						search={inactiveSearch}
						title='Inactive mods'
						type='inactive'
					/>
				</div>
				{selectedMod && (
					<ModPreviewPanel
						mod={selectedMod}
						steamPreview={steamPreview}
						message={previewMessage}
						onClose={() => setSelectedMod(null)}
					/>
				)}

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

type ModPreviewPanelProps = {
	message: string;
	mod: InstalledMod;
	onClose: () => void;
	steamPreview: SteamModPreview | null;
};

function ModPreviewPanel({
	message,
	mod,
	onClose,
	steamPreview,
}: ModPreviewPanelProps) {
	const lastUpdated = steamPreview?.timeUpdated
		? new Date(steamPreview.timeUpdated * 1000).toLocaleString()
		: null;

	return (
		<section aria-label={`${mod.name} details`} className='mod-preview'>
			<div className='panel-heading'>
				<h3>{mod.name}</h3>
				<button onClick={onClose}>Close</button>
			</div>
			<dl className='preview-fields'>
				<div>
					<dt>Package ID</dt>
					<dd>{mod.packageId}</dd>
				</div>
				<div>
					<dt>Source</dt>
					<dd>{mod.source}</dd>
				</div>
				<div>
					<dt>Installed path</dt>
					<dd>{mod.path}</dd>
				</div>
				{mod.publishedFileId && (
					<div>
						<dt>Steam Workshop ID</dt>
						<dd>{mod.publishedFileId}</dd>
					</div>
				)}
			</dl>
			{mod.description && (
				<div>
					<h4>About this mod</h4>
					<p className='preview-description'>{mod.description}</p>
				</div>
			)}
			{steamPreview && (
				<div>
					<h4>Steam Workshop</h4>
					<p>{steamPreview.title}</p>
					{lastUpdated && <p>Last updated {lastUpdated}</p>}
					{steamPreview.previewUrl && (
						<img
							className='steam-preview-image'
							src={steamPreview.previewUrl}
							alt={`Steam Workshop preview for ${steamPreview.title}`}
						/>
					)}
					{steamPreview.description && (
						<p className='preview-description'>
							{steamPreview.description}
						</p>
					)}
				</div>
			)}
			<p aria-live='polite' className='status-message'>{message}</p>
		</section>
	);
}

type ModListPanelProps = {
	count: number;
	emptyMessage: string;
	modDetailsByPackageId: ReadonlyMap<string, InstalledMod>;
	mods: { packageId: string; index: number }[];
	onSelectMod: (packageId: string) => void;
	onDropMod: (
		sourceIndex: number,
		source: ModListType,
		target: ModListType,
	) => void;
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
	onSelectMod,
	onDropMod,
	onSearch,
	search,
	title,
	type,
}: ModListPanelProps) {
	function handleDrop(event: ReactDragEvent<HTMLDivElement>) {
		event.preventDefault();
		const payload = parseModDragPayload(
			event.dataTransfer.getData(MOD_DRAG_MIME),
		);
		if (payload) onDropMod(payload.index, payload.source, type);
	}
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
			<div
				className='mod-list'
				onDragOver={(event) => {
					event.preventDefault();
					event.dataTransfer.dropEffect = 'move';
				}}
				onDrop={handleDrop}
			>
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
							<div
								className='mod-row'
								aria-label={`Show details for ${mod?.name ?? packageId}`}
								draggable
								key={`${packageId}-${index}`}
								role='button'
								tabIndex={0}
								onClick={() => onSelectMod(packageId)}
								onKeyDown={(event) => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										onSelectMod(packageId);
									}
								}}
								onDragStart={(event) => {
									event.dataTransfer.effectAllowed = 'move';
									event.dataTransfer.setData(
										MOD_DRAG_MIME,
										JSON.stringify({ index, source: type }),
									);
								}}
							>
								<div className='mod-labels'>
									<span className='mod-name'>{mod?.name ?? packageId}</span>
									{mod && (
										<span className='package-id'>
											{mod.packageId} · {mod.source}
										</span>
									)}
								</div>
							</div>
						);
					})}
			</div>
		</section>
	);
}

export default App;
