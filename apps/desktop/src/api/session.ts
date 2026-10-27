let nativeToken: Promise<string> | null = null;
export async function sessionHeaders(): Promise<Record<string, string>> {
  if ('__TAURI_INTERNALS__' in window) {
    nativeToken ??= import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke<string>('session_token'),
    );
    return { 'X-Lab-Token': await nativeToken };
  }
  const token = document.querySelector<HTMLMetaElement>('meta[name="lab-session"]')?.content;
  return token ? { 'X-Lab-Token': token } : {};
}
