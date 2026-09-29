import { useAtom } from 'jotai';
import { invokeDesktop } from '../../utils/tauri';
import { steamApiKeyConfiguredAtom, steamApiMessageAtom } from './atoms';

let steamApiKeyStatusRequest: Promise<boolean> | null = null;

export function useSteamApiKeyController() {
	const [, setSteamApiKeyConfigured] = useAtom(steamApiKeyConfiguredAtom);
	const [, setSteamApiMessage] = useAtom(steamApiMessageAtom);
	async function refreshSteamApiKeyStatus() {
		const statusRequest = steamApiKeyStatusRequest ??
			invokeDesktop<boolean>('steam_api_key_configured');
		steamApiKeyStatusRequest = statusRequest;
		try {
			const configured = await statusRequest;
			setSteamApiKeyConfigured(configured);
			setSteamApiMessage(
				configured
					? 'Steam Web API key is stored in Windows Credential Manager.'
					: 'No Steam Web API key is stored.',
			);
		} catch (error) {
			steamApiKeyStatusRequest = null;
			setSteamApiMessage(
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	async function saveSteamApiKey(apiKey: string) {
		setSteamApiMessage('Saving Steam Web API key securely…');
		try {
			await invokeDesktop('save_steam_api_key', { apiKey });
			steamApiKeyStatusRequest = Promise.resolve(true);
			setSteamApiKeyConfigured(true);
			setSteamApiMessage('Steam Web API key saved securely.');
			return true;
		} catch (error) {
			setSteamApiMessage(
				error instanceof Error ? error.message : String(error),
			);
			return false;
		}
	}

	async function testSteamApiConnection() {
		setSteamApiMessage('Testing Steam Web API connection…');
		try {
			await invokeDesktop('test_steam_api_connection');
			steamApiKeyStatusRequest = Promise.resolve(true);
			setSteamApiKeyConfigured(true);
			setSteamApiMessage('Steam Web API connection verified.');
		} catch (error) {
			setSteamApiMessage(
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	async function removeSteamApiKey() {
		setSteamApiMessage('Removing Steam Web API key…');
		try {
			await invokeDesktop('remove_steam_api_key');
			steamApiKeyStatusRequest = Promise.resolve(false);
			setSteamApiKeyConfigured(false);
			setSteamApiMessage('Steam Web API key removed.');
		} catch (error) {
			setSteamApiMessage(
				error instanceof Error ? error.message : String(error),
			);
		}
	}
	return {
		refreshSteamApiKeyStatus,
		saveSteamApiKey,
		testSteamApiConnection,
		removeSteamApiKey,
	};
}
