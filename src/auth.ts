import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db, ensureSchema } from "@/lib/db";

// GitHub OAuth. The `repo` scope lets us check push-access on private repos too.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: { params: { scope: "read:user repo" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // On sign-in, persist the GitHub access token server-side (never exposed
      // to the client) so agent/API-token requests can act on the user's behalf.
      if (account?.access_token && profile) {
        const login = String(profile.login);
        token.login = login;
        await ensureSchema();
        await db().execute({
          sql: `INSERT INTO users (login, name, avatar_url, github_token, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(login) DO UPDATE SET
                  name = excluded.name,
                  avatar_url = excluded.avatar_url,
                  github_token = excluded.github_token,
                  updated_at = excluded.updated_at`,
          args: [
            login,
            (profile.name as string) ?? null,
            (profile.avatar_url as string) ?? null,
            account.access_token,
            Date.now(),
          ],
        });
      }
      return token;
    },
    async session({ session, token }) {
      if (token.login) {
        (session.user as { login?: string }).login = String(token.login);
      }
      return session;
    },
  },
});
