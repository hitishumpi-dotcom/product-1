import path from 'path';

export const WORKSPACE = path.resolve('/home/user/OpenClaw');

export function safeJoin(base: string, rel: string): string {
  const resolved = path.resolve(base, rel);
  if (!resolved.startsWith(base)) {
    throw new Error('Path traversal rejected');
  }
  return resolved;
}
