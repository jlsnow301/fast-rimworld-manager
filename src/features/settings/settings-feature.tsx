import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAtomValue } from 'jotai';
import {
	databaseMessageAtom,
	downloadingDatabaseAtom,
	pathSettingsAtom,
	settingsMessageAtom,
	steamApiKeyConfiguredAtom,
	steamApiMessageAtom,
} from '@/features/settings/atoms';
import { useAppContext } from '@/context/app-context';
import { PATH_FIELDS } from '@/utils/mods';
import type { DatabaseKind, PathSettings } from '@/utils/types';

type DatabaseOption = {
	id: DatabaseKind;
	label: string;
	description: string;
};

const DATABASES: DatabaseOption[] = [
	{
		id: 'communityRules',
		label: 'Community Rules',
		description: 'Community-curated mod load-order rules.',
	},
	{
		id: 'steamWorkshop',
		label: 'Steam Workshop',
		description: 'Mod metadata and dependency information.',
	},
];

export function SettingsFeature() {
	const {
		autoDetectPaths,
		browsePath,
		downloadDatabase,
		savePathSettings,
		updatePath,
		saveSteamApiKey,
		testSteamApiConnection,
		removeSteamApiKey,
	} = useAppContext();
	const databaseMessage = useAtomValue(databaseMessageAtom);
	const downloadingDatabase = useAtomValue(downloadingDatabaseAtom);
	const pathSettings = useAtomValue(pathSettingsAtom);
	const settingsMessage = useAtomValue(settingsMessageAtom);
	const steamApiKeyConfigured = useAtomValue(steamApiKeyConfiguredAtom);
	const steamApiMessage = useAtomValue(steamApiMessageAtom);
	const [steamApiKeyInput, setSteamApiKeyInput] = useState('');
	const [steamApiBusy, setSteamApiBusy] = useState(false);

	async function handleSaveSteamApiKey() {
		setSteamApiBusy(true);
		try {
			const saved = await saveSteamApiKey(steamApiKeyInput);
			if (saved) setSteamApiKeyInput('');
		} finally {
			setSteamApiBusy(false);
		}
	}

	async function handleTestSteamApiConnection() {
		setSteamApiBusy(true);
		try {
			await testSteamApiConnection();
		} finally {
			setSteamApiBusy(false);
		}
	}

	async function handleRemoveSteamApiKey() {
		setSteamApiBusy(true);
		try {
			await removeSteamApiKey();
		} finally {
			setSteamApiBusy(false);
		}
	}

	return (
		<section className='mx-auto w-full max-w-5xl p-6'>
			<Card>
				<CardHeader>
					<CardTitle>Settings</CardTitle>
					<CardDescription>
						RimWorld and mod folder locations
					</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-5'>
					<div className='flex flex-wrap gap-2'>
						<Button onClick={autoDetectPaths} variant='outline'>
							Auto-detect paths
						</Button>
						<Button onClick={savePathSettings}>Save paths</Button>
					</div>
					<FieldGroup className='gap-4'>
						{PATH_FIELDS.map((field) => (
							<PathField
								key={field.key}
								label={field.label}
								name={field.key}
								onBrowse={() =>
									browsePath(field.key, field.label)}
								onChange={updatePath}
								value={pathSettings[field.key]}
							/>
						))}
					</FieldGroup>
					<p
						aria-live='polite'
						className='text-sm text-muted-foreground'
					>
						{settingsMessage}
					</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Databases</CardTitle>
					<CardDescription>
						Download compatible metadata from community-maintained
						repositories.
					</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					{DATABASES.map((database) => (
						<div
							className='flex flex-wrap items-center justify-between gap-3'
							key={database.id}
						>
							<div>
								<h3 className='font-medium'>
									{database.label}
								</h3>
								<p className='text-sm text-muted-foreground'>
									{database.description}
								</p>
							</div>
							<Button
								aria-label={`Download or update ${database.label} database`}
								disabled={downloadingDatabase !== null}
								onClick={() => downloadDatabase(database.id)}
								variant='outline'
							>
								{downloadingDatabase === database.id
									? 'Downloading…'
									: 'Download / update'}
							</Button>
						</div>
					))}
					<p
						aria-live='polite'
						className='text-sm text-muted-foreground'
					>
						{databaseMessage}
					</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Steam Web API</CardTitle>
					<CardDescription>
						Create a personal 32-character API key at
						https://steamcommunity.com/dev/apikey. The key is kept
						in Windows Credential Manager and never shown again.
					</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor='steam-api-key'>
								Steam Web API key
							</FieldLabel>
							<div className='flex min-w-0 items-center gap-2'>
								<Input
									autoComplete='off'
									className='min-w-0 flex-1'
									id='steam-api-key'
									onChange={(event) =>
										setSteamApiKeyInput(
											event.currentTarget.value,
										)}
									placeholder='Enter your 32-character key'
									spellCheck={false}
									type='password'
									value={steamApiKeyInput}
								/>
								<Button
									aria-label='Clear Steam Web API key'
									disabled={steamApiBusy || !steamApiKeyInput}
									onClick={() => setSteamApiKeyInput('')}
									type='button'
									variant='outline'
								>
									Clear
								</Button>
							</div>
						</Field>
					</FieldGroup>
					<div className='flex flex-wrap gap-2'>
						<Button
							disabled={steamApiBusy ||
								steamApiKeyInput.trim().length === 0}
							onClick={handleSaveSteamApiKey}
						>
							Save API key
						</Button>
						<Button
							disabled={steamApiBusy || !steamApiKeyConfigured}
							onClick={handleTestSteamApiConnection}
							variant='outline'
						>
							Test connection
						</Button>
						<Button
							disabled={steamApiBusy || !steamApiKeyConfigured}
							onClick={handleRemoveSteamApiKey}
							variant='outline'
						>
							Remove key
						</Button>
					</div>
					<p
						aria-live='polite'
						className='text-sm text-muted-foreground'
					>
						{steamApiKeyConfigured
							? 'A Steam Web API key is stored securely.'
							: 'No Steam Web API key is stored.'}
					</p>
					<p aria-live='polite' className='text-sm'>
						{steamApiMessage}
					</p>
				</CardContent>
			</Card>
		</section>
	);
}

type PathFieldProps = {
	label: string;
	name: keyof PathSettings;
	onBrowse: () => void;
	onChange: (key: keyof PathSettings, value: string) => void;
	value: string;
};

function PathField(props: PathFieldProps) {
	const { label, name, onBrowse, onChange, value } = props;
	return (
		<Field>
			<FieldLabel htmlFor={`path-${name}`}>{label}</FieldLabel>
			<div className='flex items-center gap-2'>
				<Input
					autoComplete='off'
					className='min-w-0 flex-1'
					id={`path-${name}`}
					onChange={(event) =>
						onChange(name, event.currentTarget.value)}
					placeholder='Enter folder path'
					spellCheck={false}
					value={value}
				/>
				<Button
					aria-label={`Clear ${label}`}
					disabled={!value}
					onClick={() => onChange(name, '')}
					type='button'
					variant='outline'
				>
					Clear
				</Button>
				<Button onClick={onBrowse} type='button' variant='outline'>
					Browse
				</Button>
			</div>
		</Field>
	);
}
