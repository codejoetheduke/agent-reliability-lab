type RuntimeSession = { token: string; api_url: string };
let nativeSession: Promise<RuntimeSession> | null = null;
export async function runtimeSession(): Promise<RuntimeSession> {
  if ('__TAURI_INTERNALS__' in window) {
    nativeSession ??= import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke<RuntimeSession>('session_info'))
      .catch((error) => {
        nativeSession = null;
        throw error;
      });
    return nativeSession;
  }
  return {
    token: document.querySelector<HTMLMetaElement>('meta[name="lab-session"]')?.content ?? '',
    api_url: 'http://127.0.0.1:8765',
  };
}
export async function sessionHeaders(): Promise<Record<string, string>> {
  const { token } = await runtimeSession();
  return token ? { 'X-Lab-Token': token } : {};
}
