import { invoke } from '@tauri-apps/api/core';

const TAURI_RUNTIME_REQUIRED =
	'Native RimWorld access requires the Tauri desktop app. Run `deno task tauri dev`.';

export function invokeDesktop<T>(
	command: string,
	args?: Record<string, unknown>,
) {
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
