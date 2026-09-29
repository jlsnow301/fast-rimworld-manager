import './globals.css';
import { useAtomValue } from 'jotai';
import { settingsOpenAtom } from './features/settings/atoms';
import { AppProvider } from './context/app-context';
import { AppHeader } from './features/header/app-header';
import { ModListFeature } from './features/mod-list/mod-list-feature';
import { SettingsFeature } from './features/settings/settings-feature';
import { useAppController } from './hooks/use-app-controller';

export function App() {
	const controller = useAppController();
	const settingsOpen = useAtomValue(settingsOpenAtom);

	return (
		<AppProvider value={controller}>
			<main className='min-h-screen'>
				<AppHeader />
				{settingsOpen ? <SettingsFeature /> : <ModListFeature />}
			</main>
		</AppProvider>
	);
}
