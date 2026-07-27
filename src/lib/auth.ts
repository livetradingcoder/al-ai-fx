import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import type { NextAuthOptions, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyMagicLinkToken } from "@/lib/magic-links";

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
    }),
    CredentialsProvider({
      id: "magic-link",
      name: "Magic Link",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token || !process.env.NEXTAUTH_SECRET) {
          return null;
        }

        try {
          const payload = verifyMagicLinkToken(credentials.token, process.env.NEXTAUTH_SECRET);
          const user = await prisma.user.findUnique({
            where: { id: payload.userId },
          });

          if (!user || user.email !== payload.email || user.isBlocked || user.isDeleted) {
            return null;
          }

          if (user.shouldResetPassword) {
            await prisma.user.update({
              where: { id: user.id },
              data: { shouldResetPassword: false },
            });
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          console.error("[Auth] Invalid magic link token:", error);
          return null;
        }
      },
    })
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;

        // Record the sign-in so the device is visible and revocable. JWTs are
        // stateless; this row is what makes "sign out everywhere" possible.
        try {
          const jti = randomUUID();
          const headerList = await headers();
          await prisma.userSession.create({
            data: {
              jti,
              userId: user.id,
              userAgent: headerList.get("user-agent")?.slice(0, 400) ?? null,
              ip:
                headerList.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 60) ??
                null,
            },
          });
          token.sid = jti;
        } catch (err) {
          // Never block a legitimate sign-in because bookkeeping failed.
          console.error("[Auth] Could not record session:", err);
        }
        return token;
      }

      // Reject tokens whose session was revoked. Fail OPEN on database
      // trouble — a DB blip must not sign every customer out.
      if (typeof token.sid === "string") {
        try {
          const row = await prisma.userSession.findUnique({
            where: { jti: token.sid },
            select: { revokedAt: true, lastSeenAt: true },
          });
          // Returning null here breaks NextAuth's session callback, so strip
          // the identity instead: no id/role means our pages treat it as
          // signed out and redirect to /login.
          if (!row || row.revokedAt) {
            delete token.id;
            delete token.role;
            delete token.sid;
            return token;
          }

          // Throttle the write: once every 10 minutes is enough to show
          // "last used" without a database write per request.
          if (Date.now() - row.lastSeenAt.getTime() > 10 * 60_000) {
            await prisma.userSession.update({
              where: { jti: token.sid },
              data: { lastSeenAt: new Date() },
            });
          }
        } catch (err) {
          console.error("[Auth] Session check failed (allowing):", err);
        }
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token?.role && token?.id) {
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
