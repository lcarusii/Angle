import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Keep imports lazy so production runtime doesn't load dev-only modules.
  return void (async () => {
    try {
      const { app } = await import('../server');
      // @ts-ignore - Express and Vercel types are compatible at runtime.
      return app(req, res);
    } catch (err: any) {
      if (!res.headersSent) {
        res
          .status(500)
          .setHeader('Content-Type', 'application/json; charset=utf-8')
          .end(
            JSON.stringify({
              error: 'FUNCTION_INIT_FAILED',
              message: err?.message || String(err),
              stack: err?.stack,
            })
          );
      }
    }
  })();
}

