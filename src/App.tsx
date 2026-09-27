import './globals.css';
import { AppProvider } from './context/app-context';
import { AppHeader } from './features/header/app-header';
import { ModListFeature } from './features/mod-list/mod-list-feature';
import { SettingsFeature } from './features/settings/settings-feature';
import { useAppController } from './hooks/use-app-controller';

function App() {
	const controller = useAppController();

	return (
		<AppProvider value={controller}>
			<main className='min-h-screen'>
				<AppHeader />
				{controller.settingsOpen ? <SettingsFeature /> : <ModListFeature />}
			</main>
		</AppProvider>
	);
}

export default App;
