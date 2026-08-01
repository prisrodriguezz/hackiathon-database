import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { LegislativeDocument } from '@legislative/shared';

const document: LegislativeDocument = {
  id: 'doc-0001',
  title: 'Ejemplo: proyecto de ley',
  status: 'parsed',
  sourceUrl: 'https://ejemplo.gob.ar/leyes/0001',
  createdAt: new Date().toISOString(),
};

const paramSchema = z.object({ id: z.string().min(1) });

export const example = new Hono()
  .get('/example', (c) => c.json({ data: document }))
  .get('/documents/:id', zValidator('param', paramSchema), (c) => {
    const { id } = c.req.valid('param');
    return c.json({ data: { ...document, id } });
  });
