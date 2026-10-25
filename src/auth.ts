import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { signInSchema } from "@/lib/validation";
import { prisma } from "@/server/db";
import { verifyPasswordOrDummy } from "@/server/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = signInSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        // Same work whether or not the email exists (no timing-based account discovery).
        if (!(await verifyPasswordOrDummy(parsed.data.password, user?.passwordHash)) || !user) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});
