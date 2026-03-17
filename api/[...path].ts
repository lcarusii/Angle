import type { VercelRequest, VercelResponse } from '@vercel/node';
import { app } from '../server';

// Vercel Serverless Function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // @ts-ignore - Express 和 Vercel 类型兼容
  app(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
