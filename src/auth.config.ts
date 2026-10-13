import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

/**
 * The part of the Auth.js config that does not touch the database, so it can
 * be imported by the proxy (middleware) as well as by the full config in
 * auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  // Credentials sign-in requires JWT sessions. The role is copied into the
  // token at sign-in; server code re-reads it from the DB for anything sensitive.
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
} satisfies NextAuthConfig;
