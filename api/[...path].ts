import type { VercelRequest, VercelResponse } from '@vercel/node';
import { app } from '../server';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Express app acts as a handler for Vercel req/res.
  // @ts-ignore - Express and Vercel types are compatible at runtime.
  return app(req, res);
}

