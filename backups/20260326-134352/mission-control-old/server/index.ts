import express from 'express';
import cors from 'cors';
import { router as filesRouter } from './routes/files';
import { router as memoryRouter } from './routes/memory';
import { router as projectsRouter } from './routes/projects';
import { router as processesRouter } from './routes/processes';
import { router as chatRouter } from './routes/chat';

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:5174' }));
app.use(express.json());

app.use('/api/files',     filesRouter);
app.use('/api/memory',    memoryRouter);
app.use('/api/projects',  projectsRouter);
app.use('/api/processes', processesRouter);
app.use('/api/chat',      chatRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] listening on http://127.0.0.1:${PORT}`);
});
