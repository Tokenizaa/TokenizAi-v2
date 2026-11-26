let initialization: Promise<void> | undefined;

export default async function handler(req: any, res: any): Promise<void> {
  try {
    // Load the application inside the guarded boundary. A static import would
    // crash the Vercel function before this handler can translate startup errors.
    const { app, initializeServerState } = await import('../server.ts');

    initialization ??= initializeServerState().catch((error) => {
      initialization = undefined;
      throw error;
    });

    await initialization;
    app(req, res);
  } catch (error) {
    const details = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };
    console.error('[TokenizAi] Serverless request failed:', JSON.stringify(details));
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        ok: false,
        error: 'Backend indisponível durante a inicialização. Consulte os logs da função.',
        code: 'BACKEND_INITIALIZATION_FAILED',
      }));
    }
  }
}
