import { Hono } from 'hono';

const app = new Hono();

app.get('/__demo/health', (c) => c.json({ ok: true }));

export default app;
