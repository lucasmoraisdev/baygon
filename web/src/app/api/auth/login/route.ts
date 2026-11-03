import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:8001/api/v1';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { detail: 'Email e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    // 1. Faz a autenticação direto no FastAPI (server-to-server)
    const loginResponse = await fetch(`${BACKEND_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const loginData = await loginResponse.json();

    if (!loginResponse.ok) {
      return NextResponse.json(
        { detail: loginData.detail || 'Falha na autenticação.' },
        { status: loginResponse.status }
      );
    }

    // 2. Busca os dados do usuário autenticado usando o access_token
    const userResponse = await fetch(`${BACKEND_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${loginData.access_token}`,
      },
    });

    const userData = userResponse.ok ? await userResponse.json() : null;

    return NextResponse.json({
      access_token: loginData.access_token,
      refresh_token: loginData.refresh_token,
      user: userData,
    });
  } catch (error: any) {
    console.error('Erro no BFF de login:', error);
    return NextResponse.json(
      { detail: 'Erro interno ao processar autenticação no servidor.' },
      { status: 500 }
    );
  }
}

