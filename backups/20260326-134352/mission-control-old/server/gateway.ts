/**
 * Reads Gateway connection details from ~/.openclaw/openclaw.json at runtime.
 * Token is never written to workspace files or sent to the frontend.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

interface GatewayConfig {
  url: string;
  token: string;
  enabled: boolean;
}

interface OpenClawConfig {
  gateway?: {
    port?: number;
    bind?: string;
    auth?: { mode?: string; token?: string; password?: string };
    http?: { endpoints?: { chatCompletions?: { enabled?: boolean } } };
  };
}

export function getGatewayConfig(): GatewayConfig {
  const cfgPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  let cfg: OpenClawConfig = {};
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as OpenClawConfig;
  } catch {
    // fall through to defaults
  }

  const port    = cfg.gateway?.port ?? 18789;
  const bind    = cfg.gateway?.bind === 'loopback' ? '127.0.0.1' : (cfg.gateway?.bind ?? '127.0.0.1');
  const token   = cfg.gateway?.auth?.token ?? cfg.gateway?.auth?.password ?? '';
  const enabled = cfg.gateway?.http?.endpoints?.chatCompletions?.enabled ?? false;

  return { url: `http://${bind}:${port}`, token, enabled };
}
