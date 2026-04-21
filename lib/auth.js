/**
 * NextAuth.js configuration for Vercel OAuth.
 *
 * OAuth is used for authentication (identity) only.
 * All API interactions with Vercel use the VERCEL_TOKEN from environment variables.
 */

import NextAuth from "next-auth";

export const authOptions = {
  providers: [
    {
      id: "vercel",
      name: "Vercel",
      type: "oauth",
      authorization: {
        url: "https://vercel.com/oauth/authorize",
        params: {
          scope: "email profile", // Identity only
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
      checks: ["pkce", "state"],
    },
  ],

  callbacks: {
    async jwt({ token }) {
      // No need to store access token anymore as we use a service token
      return token;
    },
    async session({ session }) {
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
