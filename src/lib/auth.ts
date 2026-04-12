import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { RoleKey } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";

const loginSchema = z.object({
  email: z.email("Email invalid"),
  password: z.string().min(8, "Parola trebuie sa aiba minim 8 caractere"),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/autentificare",
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

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          include: { roles: { include: { role: true } } },
        });

        if (!user || !user.isActive || user.deletedAt) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          roleKeys: user.roles.map((r) => r.role.key) as RoleKey[],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        const candidate = user as { roleKeys?: RoleKey[] };
        token.roleKeys = candidate.roleKeys || [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.roleKeys = (token.roleKeys as RoleKey[]) || [];
      }
      return session;
    },
  },
};

export const authHandler = NextAuth(authOptions);

export async function auth() {
  return getServerSession(authOptions);
}
