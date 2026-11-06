export async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return '';
}

export function isPdfTokenExpired(expiresAt: string | Date, now = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
