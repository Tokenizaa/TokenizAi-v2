import dotenv from 'dotenv';

// Carrega variáveis de ambiente antes de importar o servidor, de modo que
// TOKENIZAI_SESSION_SECRET, SUPABASE_* etc. estejam disponiveis no module-level
// de server.ts (ex.: adminAuth, repository, supabase).
dotenv.config();

// Sinaliza ao server.ts que esta rodando em contexto serverless (Vercel Functions),
// impedindo que startServer() chame http.createServer(...).listen() — incompatível
// com o modelo de request/response dos serverless functions.
process.env.SERVERLESS = '1';

import { app } from '../server.ts';

// O handler default da funcao serverless do Vercel. Recebe requisicoes sob /api/*
// e as despacha para o roteador Express montado em server.ts.
export default app;
