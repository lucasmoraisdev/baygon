import { NextRequest, NextResponse } from 'next/server';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'associacao.com';
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT || 'baygon';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';

  // Limpa porta de desenvolvimento local (ex: localhost:3000 -> localhost)
  const hostWithoutPort = hostname.split(':')[0].toLowerCase();
  const isLocalhost = hostWithoutPort === 'localhost' || hostWithoutPort.endsWith('.localhost') || hostWithoutPort === '127.0.0.1';

  let subdomain: string | null = null;

  if (isLocalhost) {
    // Ex: liga1.localhost:3000 -> subdomain = "liga1"
    const parts = hostWithoutPort.split('.');
    if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== '127') {
      subdomain = parts[0];
    } else {
      // Localhost puro acessado diretamente: fallback para o tenant padrão de desenvolvimento
      subdomain = DEFAULT_TENANT;
    }
  } else {
    // Produção / Staging (ex: liga1.associacao.com -> subdomain = "liga1")
    if (hostWithoutPort.endsWith(`.${ROOT_DOMAIN}`)) {
      subdomain = hostWithoutPort.replace(`.${ROOT_DOMAIN}`, '');
    } else if (hostWithoutPort === ROOT_DOMAIN || hostWithoutPort === `www.${ROOT_DOMAIN}`) {
      // Domínio raiz sem subdomínio
      subdomain = null;
    } else {
      // Domínio customizado ou subdomínio de outro provedor
      const parts = hostWithoutPort.split('.');
      if (parts.length > 2) {
        subdomain = parts[0];
      }
    }
  }

  // Fallback caso não encontre
  const resolvedSlug = subdomain || DEFAULT_TENANT;

  // Injeta o slug no cabeçalho da requisição para os Server Components
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-tenant-slug', resolvedSlug);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Também registra no cookie seguro para leitura rápida no client-side
  response.cookies.set('baygon_tenant_slug', resolvedSlug, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Intercepta todas as rotas exceto arquivos estáticos, imagens e favicon
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
