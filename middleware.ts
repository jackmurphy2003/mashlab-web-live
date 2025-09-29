import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const isApi = url.pathname.startsWith('/api');
  const isAccess = url.pathname.startsWith('/access');
  const isStatic = url.pathname.startsWith('/_next') || url.pathname === '/favicon.ico' || url.pathname.startsWith('/brand');
  const hasCookie = req.cookies.get('ml_preview')?.value === 'ok';

  if (!isApi && !isAccess && !isStatic && !hasCookie) {
    url.pathname = '/access';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/:path*'] };
