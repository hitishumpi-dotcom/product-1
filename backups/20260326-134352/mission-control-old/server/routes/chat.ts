import { Router } from 'express';
import type { Request, Response } from 'express';
import { getGatewayConfig } from '../gateway';

export const router = Router();

interface ChatRequest {
  message?: string;
  lane?: string;
  history?: { role: string; content: string }[];
}

// GET /api/chat/status — check if Gateway completions endpoint is reachable + enabled
router.get('/status', async (_req: Request, res: Response) => {
  const gw = getGatewayConfig();
  if (!gw.enabled) {
    res.json({ ok: false, reason: 'chatCompletions not enabled in Gateway config' });
    return;
  }
  try {
    const r = await fetch(`${gw.url}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    res.json({ ok: r.ok, reason: r.ok ? 'Gateway reachable' : `HTTP ${r.status}` });
  } catch (e: unknown) {
    res.json({ ok: false, reason: e instanceof Error ? e.message : String(e) });
  }
});

// POST /api/chat — non-streaming
// body: { message, lane, history? }
router.post('/', async (req: Request, res: Response) => {
  const { message, lane, history } = req.body as ChatRequest;

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'message required' });
    return;
  }

  const gw = getGatewayConfig();

  if (!gw.enabled) {
    res.json({
      role: 'assistant',
      content: '⚠️ The OpenClaw Gateway chat endpoint is not enabled yet. See setup instructions in Mission Control.',
      stub: true,
    });
    return;
  }

  if (!gw.token) {
    res.status(500).json({ error: 'Gateway token not configured' });
    return;
  }

  const messages = [
    ...(history ?? []),
    { role: 'user', content: message.trim() },
  ];

  try {
    const r = await fetch(`${gw.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gw.token}`,
        'x-openclaw-agent-id': 'main',
      },
      body: JSON.stringify({
        model: 'openclaw:main',
        messages,
        user: `mission-control-${lane ?? 'worklab'}`,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!r.ok) {
      const body = await r.text().catch(() => '');
      res.status(r.status).json({ error: `Gateway error ${r.status}`, detail: body.slice(0, 500) });
      return;
    }

    const data = await r.json() as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? '(empty response)';
    res.json({ role: 'assistant', content, stub: false });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// POST /api/chat/stream — SSE streaming
router.post('/stream', async (req: Request, res: Response) => {
  const { message, lane, history } = req.body as ChatRequest;

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'message required' });
    return;
  }

  const gw = getGatewayConfig();

  if (!gw.enabled || !gw.token) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ content: '⚠️ Gateway chat endpoint not enabled. See setup instructions.', done: true, stub: true })}\n\n`);
    res.end();
    return;
  }

  const messages = [
    ...(history ?? []),
    { role: 'user', content: message.trim() },
  ];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const upstream = await fetch(`${gw.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gw.token}`,
        'x-openclaw-agent-id': 'main',
      },
      body: JSON.stringify({
        model: 'openclaw:main',
        messages,
        stream: true,
        user: `mission-control-${lane ?? 'worklab'}`,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!upstream.ok || !upstream.body) {
      const body = await upstream.text().catch(() => '');
      res.write(`data: ${JSON.stringify({ error: `Gateway ${upstream.status}`, detail: body.slice(0, 200) })}\n\n`);
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          continue;
        }
        try {
          const chunk = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
        } catch { /* skip malformed chunk */ }
      }
    }
    res.end();
  } catch (e: unknown) {
    res.write(`data: ${JSON.stringify({ error: e instanceof Error ? e.message : String(e) })}\n\n`);
    res.end();
  }
});
