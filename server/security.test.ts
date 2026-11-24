import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';

describe('Seguranca — autenticacao Supabase (ETAPA 2)', () => {
  it('GET /api/auth/me sem token e rejeitada', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('MISSING_SESSION_TOKEN');
  });

  it('GET /api/auth/me com token invalido e rejeitada', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token-invalido');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_SESSION_TOKEN');
  });

  it('POST /api/auth/bootstrap-admin sem token e rejeitada', async () => {
    const res = await request(app).post('/api/auth/bootstrap-admin');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/bootstrap-admin com token invalido e rejeitada', async () => {
    const res = await request(app)
      .post('/api/auth/bootstrap-admin')
      .set('Authorization', 'Bearer token-invalido');
    expect(res.status).toBe(401);
  });

  it('requisicao anonima nao consegue criar projeto (rota privada)', async () => {
    const res = await request(app)
      .post('/api/enterprise/projects')
      .send({ name: 'Projeto fantasma' });
    expect(res.status).toBe(403);
  });

  it('requisicao anonima nao consegue editar cliente', async () => {
    const res = await request(app)
      .patch('/api/enterprise/clients/cli-01')
      .send({ name: 'Alteracao fantasma' });
    expect(res.status).toBe(403);
  });

  describe('Leitura exige autenticacao (P0)', () => {
    it('GET /api/enterprise/state sem sessao e rejeitada', async () => {
      const res = await request(app).get('/api/enterprise/state');
      expect(res.status).toBe(403);
    });

    it('GET /api/hermes/agents sem sessao e rejeitada', async () => {
      const res = await request(app).get('/api/hermes/agents');
      expect(res.status).toBe(403);
    });
  });

  describe('Emissao de sessao exige autenticacao (P0)', () => {
    it('POST /api/auth/session sem cabecalho e rejeitada', async () => {
      const res = await request(app)
        .post('/api/auth/session')
        .send({ id: 'usr-02', name: 'Outro', email: 'outro@tokenizai.com.br', role: 'Gestor Operacional' });
      expect(res.status).toBe(401);
    });

    it('POST /api/auth/session com token invalido e rejeitada', async () => {
      const res = await request(app)
        .post('/api/auth/session')
        .set('Authorization', 'Bearer token-invalido')
        .send({ id: 'usr-02', name: 'Outro', email: 'outro@tokenizai.com.br', role: 'Gestor Operacional' });
      expect(res.status).toBe(401);
    });
  });

  describe('Bootstrap administrativo seguro (P0)', () => {
    it('POST /api/auth/bootstrap-admin sem token admin e rejeitada', async () => {
      const res = await request(app)
        .post('/api/auth/bootstrap-admin')
        .send({ password: 'senha-teste-123' });
      expect(res.status).toBe(401);
    });
  });
});
