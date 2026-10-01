import { useAtom } from 'jotai';
import { invokeDesktop } from '@/utils/tauri';
import { steamApiKeyConfiguredAtom } from '@/features/settings/atoms';

let steamApiKeyStatusRequest: Promise<boolean> | null = null;

export function useSteamApiKeyController() {
	const [, setSteamApiKeyConfigured] = useAtom(steamApiKeyConfiguredAtom);
	async function refreshSteamApiKeyStatus() {
		const statusRequest = steamApiKeyStatusRequest ??
			invokeDesktop<boolean>('steam_api_key_configured');
		steamApiKeyStatusRequest = statusRequest;
		try {
			const configured = await statusRequest;
			setSteamApiKeyConfigured(configured);
		} catch {
			steamApiKeyStatusRequest = null;
		}
	}

	async function saveSteamApiKey(apiKey: string) {
		try {
			await invokeDesktop('save_steam_api_key', { apiKey });
			steamApiKeyStatusRequest = Promise.resolve(true);
			setSteamApiKeyConfigured(true);
			return true;
		} catch {
			return false;
		}
	}

	async function testSteamApiConnection() {
		try {
			await invokeDesktop('test_steam_api_connection');
			steamApiKeyStatusRequest = Promise.resolve(true);
			setSteamApiKeyConfigured(true);
		} catch {
			return;
		}
	}

	async function removeSteamApiKey() {
		try {
			await invokeDesktop('remove_steam_api_key');
			steamApiKeyStatusRequest = Promise.resolve(false);
			setSteamApiKeyConfigured(false);
		} catch {
			return;
		}
	}
	return {
		refreshSteamApiKeyStatus,
		saveSteamApiKey,
		testSteamApiConnection,
		removeSteamApiKey,
	};
}
