import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel Serverless Function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel builds TS to JS; Node ESM runtime needs explicit .js extension.
  const { app } = await import('../server.js');
  // @ts-ignore - Express 和 Vercel 类型兼容
  app(req, res);
}
