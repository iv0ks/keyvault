// Integration smoke tests that do not require a live database.
//
// The full read-IDOR exploit (capture a leaked UUID from the activity feed,
// read the victim's secret) is verified end-to-end against the Docker stack
// (see SOLUTION.md). These tests pin the guarantees that do not touch Postgres:
//   1. the health endpoint responds, and
//   2. every secrets route refuses unauthenticated callers (the auth guard runs
//      before any DB access, so no connection is opened).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/main.js';

let app: INestApplication;

beforeAll(async () => {
  app = await createApp();
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

describe('keyvault http surface', () => {
  it('serves the health check', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.text).toBe('ok');
  });

  it('requires a session to list your own secrets', async () => {
    const res = await request(app.getHttpServer()).get('/api/secrets');
    expect(res.status).toBe(401);
  });

  it('requires a session to read the activity feed (the leak)', async () => {
    const res = await request(app.getHttpServer()).get('/api/activity');
    expect(res.status).toBe(401);
  });

  it('requires a session to read a secret by id (the IDOR endpoint)', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/secrets/b0bb0b00-0000-4000-8000-00000000b0b5',
    );
    expect(res.status).toBe(401);
  });
});
