/**
 * NextAuth.js configuration with Vercel OAuth provider.
 *
 * Each user signs in with their own Vercel account. The resulting OAuth
 * access token is stored in the session JWT and used for all API calls
 * made on their behalf — no more shared static tokens.
 */

export const authOptions = {
  providers: [
    {
      id: "vercel",
      name: "Vercel",
      type: "oauth",
      authorization: {
        url: "https://vercel.com/oauth/authorize",
        params: {
          scope: "user:email",
        },
      },
      token: "https://api.vercel.com/login/oauth/token",
      userinfo: "https://api.vercel.com/login/oauth/userinfo",
      profile(profile) {
        return {
          id: profile.user?.id || profile.id || profile.sub,
          name: profile.user?.name || profile.name,
          email: profile.user?.email || profile.email,
          image: profile.user?.avatar
            ? `https://vercel.com/api/www/avatar/${profile.user.avatar}`
            : null,
        };
      },
      clientId: process.env.VERCEL_CLIENT_ID,
      clientSecret: process.env.VERCEL_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      checks: ["state"],
    },
  ],

  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
};
