import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fbt_secret');

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Paths that don't require authentication
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname === '/' ||
    pathname.includes('.') // for static files
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get('session')?.value;

  const redirectUrl = new URL('/login', request.url);
  redirectUrl.searchParams.set('redirect', pathname);

  if (!session) {
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await jwtVerify(session, secret);
    return NextResponse.next();
  } catch (err) {
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
