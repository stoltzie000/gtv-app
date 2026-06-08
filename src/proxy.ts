import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifyJwt } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (token && verifyJwt(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);

  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/create-trip/:path*", "/trips/:path*", "/account/:path*", "/admin/:path*"],
};
