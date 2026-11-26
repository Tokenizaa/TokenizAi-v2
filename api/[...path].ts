import { app, initializeServerState } from '../server.ts';

let initialization: Promise<void> | undefined;

export default async function handler(req: any, res: any): Promise<void> {
  initialization ??= initializeServerState().catch((error) => {
    initialization = undefined;
    throw error;
  });

  try {
    await initialization;
    app(req, res);
  } catch (error) {
    console.error('[TokenizAi] Serverless initialization failed:', error instanceof Error ? error.message : String(error));
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        ok: false,
        error: 'Backend indisponível: verifique a configuração e a conectividade do Supabase.',
        code: 'BACKEND_INITIALIZATION_FAILED',
      }));
    }
  }
}
