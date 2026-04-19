import NextAuth from 'next-auth';
import { authOptions } from '../../../lib/auth';

console.log('[DEBUG] NextAuth handler initialized');

export default NextAuth(authOptions);
