import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { RoleKey } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { cache } from "react";
import { z } from "zod";
import { prisma, basePrisma } from "@/src/lib/prisma";

const JWT_ROLE_SYNC_INTERVAL_MS = 5 * 60 * 1000;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalid"),
  password: z.string().min(1, "Parola este obligatorie"),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(basePrisma as any),
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 }, // 24 hours
  pages: {
    signIn: "/autentificare",
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Parola", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        let user;
        try {
          user = await prisma.user.findFirst({
            where: { email: { equals: parsed.data.email, mode: "insensitive" } },
            include: { roles: { include: { role: true } } },
          });
        } catch {
          throw new Error("AUTH_DB_UNAVAILABLE");
        }

        if (!user || !user.isActive || user.deletedAt) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch {
          // login can continue even if last login timestamp cannot be updated
        }

        const roleKeys = user.roles.map((r) => r.role.key) as RoleKey[];

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          roleKeys,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        const candidate = user as { roleKeys?: RoleKey[]; email?: string };
        token.roleKeys = candidate.roleKeys || [];
        token.email = candidate.email;
        token.roleSyncedAt = Date.now();
      }

      const lastSyncedAt = Number(token.roleSyncedAt || 0);
      const shouldRefreshRoles = !lastSyncedAt || Date.now() - lastSyncedAt >= JWT_ROLE_SYNC_INTERVAL_MS;

      if (token.userId && shouldRefreshRoles) {
        let dbUser;
        try {
          dbUser = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: {
              email: true,
              isActive: true,
              deletedAt: true,
              roles: { include: { role: { select: { key: true } } } },
            },
          });
        } catch {
          token.roleSyncedAt = Date.now();
          return token;
        }

        if (!dbUser || !dbUser.isActive || dbUser.deletedAt) {
          token.roleKeys = [];
          token.roleSyncedAt = Date.now();
          return token;
        }

        token.roleKeys = dbUser.roles.map((item) => item.role.key) as RoleKey[];
        token.email = dbUser.email;
        token.roleSyncedAt = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.roleKeys = (token.roleKeys as RoleKey[]) || [];
        session.user.email = (token.email as string | undefined) || session.user.email;
      }
      return session;
    },
  },
};

export const authHandler = NextAuth(authOptions);
const cachedAuth = cache(() => getServerSession(authOptions));

export async function auth() {
  return cachedAuth();
}
