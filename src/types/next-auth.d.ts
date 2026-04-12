import { RoleKey } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      roleKeys: RoleKey[];
    };
  }

  interface User {
    roleKeys: RoleKey[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    roleKeys: RoleKey[];
  }
}
