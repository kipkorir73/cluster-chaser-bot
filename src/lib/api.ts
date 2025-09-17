export function getApiBase(): string {
	const fromEnv = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
	if (fromEnv && fromEnv.trim().length > 0) return fromEnv.replace(/\/$/, '');
	return '';
}

export async function apiFetch(input: string, init?: RequestInit) {
	const base = getApiBase();
	const url = base ? `${base}${input.startsWith('/') ? input : `/${input}`}` : input;
	return fetch(url, init);
}

