import { PATH_FIELDS } from '../../utils/mods';
import type { PathSettings } from '../../utils/types';
import { useAppContext } from '../../context/app-context';

export function SettingsFeature() {
	const {
		autoDetectPaths,
		pathSettings,
		savePathSettings,
		settingsMessage,
		updatePath,
	} = useAppContext();

	return (
		<section className='content settings-panel'>
			<div className='page-heading'>
				<div>
					<h2>Settings</h2>
					<p>RimWorld and mod folder locations</p>
				</div>
			</div>
			<div className='settings-actions'>
				<button onClick={autoDetectPaths}>Auto-detect paths</button>
				<button onClick={savePathSettings}>Save paths</button>
			</div>
			<div className='path-fields'>
				{PATH_FIELDS.map(({ key, label }) => (
					<PathField
						key={key}
						label={label}
						name={key}
						onChange={updatePath}
						value={pathSettings[key]}
					/>
				))}
			</div>
			<p aria-live='polite' className='status-message'>{settingsMessage}</p>
		</section>
	);
}

type PathFieldProps = {
	label: string;
	name: keyof PathSettings;
	onChange: (key: keyof PathSettings, value: string) => void;
	value: string;
};

function PathField({ label, name, onChange, value }: PathFieldProps) {
	return (
		<label className='path-field' htmlFor={`path-${name}`}>
			<span>{label}</span>
			<input
				autoComplete='off'
				id={`path-${name}`}
				onChange={(event) => onChange(name, event.currentTarget.value)}
				placeholder='Enter folder path'
				spellCheck={false}
				value={value}
			/>
		</label>
	);
}
