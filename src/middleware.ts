import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      // Admin route protection
      if (req.nextUrl.pathname.startsWith('/admin')) {
        return token?.role === "ADMIN";
      }
      // Dashboard route protection
      if (req.nextUrl.pathname.startsWith('/dashboard')) {
        return !!token;
      }
      return true;
    },
  },
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
