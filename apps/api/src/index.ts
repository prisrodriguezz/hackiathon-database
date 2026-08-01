import { Hono } from 'hono';
import { example } from './routes/example';

const app = new Hono();

app.get('/', (c) => c.json({ name: '@legislative/api', status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.route('/api', example);

const port = Number(process.env.PORT ?? 3000);
const server = Bun.serve({ port, fetch: app.fetch });

console.log(`@legislative/api listening on http://localhost:${server.port}`);
