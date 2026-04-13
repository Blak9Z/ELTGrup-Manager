import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { RoleKey } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";

const loginSchema = z.object({
  email: z.email("Email invalid"),
  password: z.string().min(1, "Parola este obligatorie"),
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
          where: { email: parsed.data.email.toLowerCase() },
          include: { roles: { include: { role: true } } },
        });

        if (!user || !user.isActive || user.deletedAt) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

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
      }

      if (token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: {
            email: true,
            isActive: true,
            deletedAt: true,
            roles: { include: { role: { select: { key: true } } } },
          },
        });

        if (!dbUser || !dbUser.isActive || dbUser.deletedAt) {
          token.roleKeys = [];
          return token;
        }

        token.roleKeys = dbUser.roles.map((item) => item.role.key) as RoleKey[];
        token.email = dbUser.email;
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

export async function auth() {
  return getServerSession(authOptions);
}
