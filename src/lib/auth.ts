import type { NextAuthOptions, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("[Auth] Missing email or password");
          return null;
        }

        const email = credentials.email.trim().toLowerCase();
        console.log(`[Auth] Attempting login`);

        try {
          const user = await prisma.user.findUnique({
            where: { email }
          });

          if (!user) {
            console.log(`[Auth] User not found`);
            return null;
          }

          if (user.isBlocked) {
            console.log(`[Auth] User is blocked`);
            throw new Error("Your account has been restricted.");
          }

          if (user.isDeleted) {
            console.log(`[Auth] User is deleted`);
            throw new Error("Your account has been deleted.");
          }

          if (!user.passwordHash) {
            console.log(`[Auth] User has no password hash`);
            return null;
          }

          const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

          if (!isValid) {
            console.log(`[Auth] Invalid password`);
            return null;
          }

          console.log(`[Auth] Login successful: ${user.role}`);
          return { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            role: user.role 
          };
        } catch (error) {
          console.error("[Auth] Database error during authorize:", error);
          // Re-throw user-facing errors
          if (error instanceof Error && (
            error.message.includes("restricted") ||
            error.message.includes("deleted")
          )) {
            throw error;
          }
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.role && token.id) {
        session.user.role = token.role;
        session.user.id = token.id;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
