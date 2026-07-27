import { type UserRole } from "@prisma/client";
import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRole;
    };
  }

  interface User {
    id: string;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    /** UserSession.jti. NOT named `jti`: NextAuth owns that claim and would
     *  overwrite it, which silently breaks revocation lookups. */
    sid?: string;
  }
}
