import { invoke } from '@tauri-apps/api/core';

const TAURI_RUNTIME_REQUIRED =
	'Native RimWorld access requires the Tauri desktop app. Run `deno task tauri dev`.';

export function ensureDesktopRuntime() {
	const internals = (
		window as Window & {
			__TAURI_INTERNALS__?: { invoke?: unknown };
		}
	).__TAURI_INTERNALS__;
	if (typeof internals?.invoke !== 'function') {
		throw new Error(TAURI_RUNTIME_REQUIRED);
	}
}

export function invokeDesktop<T>(
	command: string,
	args?: Record<string, unknown>,
) {
	try {
		ensureDesktopRuntime();
	} catch (error) {
		return Promise.reject(error);
	}
	return invoke<T>(command, args);
}
