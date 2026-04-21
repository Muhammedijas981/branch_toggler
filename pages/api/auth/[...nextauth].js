import NextAuth from 'next-auth';
import { authOptions } from '../../../lib/auth';

export default function handler(req, res) {
  // Log the full authorization URL being built
  if (req.url?.includes('signin/vercel')) {
    console.log('[AUTH] Sign-in initiated, query:', req.query);
  }
  return NextAuth(req, res, authOptions);
}
