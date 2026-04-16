import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Mocking user verification. 
        // In reality, this would use Prisma to verify bcrypt hashes.
        if (credentials?.email === "admin@AL-ai-FX.com" && credentials?.password === "admin") {
          return { id: "1", name: "Admin", email: "admin@AL-ai-FX.com", role: "ADMIN" };
        }
        if (credentials?.email && credentials?.password === "password") {
          return { id: "2", name: "Trader", email: credentials.email, role: "USER" };
        }
        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        session.user.role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: "jwt" as const }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
