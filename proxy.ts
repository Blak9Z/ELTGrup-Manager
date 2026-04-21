import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccessPath, getDefaultModulePath } from "@/src/lib/access-control";

const publicRoutes = ["/autentificare", "/api/auth", "/_next", "/favicon.ico"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/autentificare", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const user = {
    roleKeys: (token.roleKeys as string[] | undefined) || [],
    email: (token.email as string | undefined) || null,
  };
  const allowed = canAccessPath(user, pathname);
  if (!allowed) {
    const fallbackPath = getDefaultModulePath(user);
    const safeFallbackPath = fallbackPath !== pathname ? fallbackPath : "/autentificare";
    return NextResponse.redirect(new URL(safeFallbackPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"],
};
