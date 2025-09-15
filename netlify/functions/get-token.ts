import type { Context } from '@netlify/functions';

export default async (req: Request, context: Context) => {
  const token = process.env.VITE_DERIV_API_TOKEN;

  if (!token) {
    return new Response(JSON.stringify({ error: 'API token not found' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
