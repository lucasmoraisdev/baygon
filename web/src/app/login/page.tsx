'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { FormField } from '@/components/FormField';

export default function LoginPage() {
	const { login } = useAuth();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [forgotMode, setForgotMode] = useState(false);
	const [forgotEmail, setForgotEmail] = useState('');
	const [forgotMessage, setForgotMessage] = useState<string | null>(null);

	const loginMutation = useMutation({
		mutationFn: async () => {
			// Dispara para o BFF interno do Next.js
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email, password }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.detail || 'Credenciais inválidas');
			}

			if (data.access_token) {
				login(data.access_token, data.refresh_token ?? null, data.user);
			}
		},
	});

	const forgotMutation = useMutation({
		mutationFn: () =>
			fetchAPI('/forgot-password', {
				method: 'POST',
				body: JSON.stringify({ email: forgotEmail }),
			}),
		onSuccess: (res: { message?: string }) => {
			setForgotMessage(
				res.message ??
					'Se o e-mail estiver cadastrado, enviaremos instruções para redefinição de senha.',
			);
		},
	});

	return (
		<div className="min-h-screen flex items-center justify-center bg-background px-4">
			<div className="bg-surface border border-border rounded-xl p-8 w-full max-w-sm shadow-[0_10px_25px_rgba(0,0,0,0.5)]">
				<div className="text-center text-2xl font-bold text-primary mb-6">Baygon</div>

				{forgotMode ? (
					<>
						<h2 className="text-xl font-semibold text-main mb-1">Recuperar Senha</h2>
						<p className="text-sm text-muted mb-6">
							Informe seu e-mail para receber o link de redefinição
						</p>

						{forgotMessage && (
							<div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg px-4 py-3 mb-4">
								{forgotMessage}
							</div>
						)}

						{forgotMutation.isError && (
							<div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
								{(forgotMutation.error as any)?.message ?? 'Erro ao solicitar redefinição'}
							</div>
						)}

						<form
							onSubmit={(e) => {
								e.preventDefault();
								setForgotMessage(null);
								forgotMutation.mutate();
							}}
							className="flex flex-col gap-4"
						>
							<FormField label="E-mail">
								<Input
									type="email"
									value={forgotEmail}
									onChange={(e) => setForgotEmail(e.target.value)}
									placeholder="seu@email.com"
									required
								/>
							</FormField>
							<Button type="submit" disabled={forgotMutation.isPending}>
								{forgotMutation.isPending ? 'Enviando...' : 'Enviar Link de Redefinição'}
							</Button>
							<button
								type="button"
								onClick={() => {
									setForgotMode(false);
									setForgotMessage(null);
								}}
								className="text-xs text-muted hover:text-main text-center cursor-pointer"
							>
								Voltar para o login
							</button>
						</form>
					</>
				) : (
					<>
						<h2 className="text-xl font-semibold text-main mb-1">Bem-vindo de volta</h2>
						<p className="text-sm text-muted mb-6">Faça login para gerenciar o campeonato</p>

						{loginMutation.isError && (
							<div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
								{(loginMutation.error as any)?.message ?? 'Credenciais inválidas'}
							</div>
						)}

						<form
							onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(); }}
							className="flex flex-col gap-4"
						>
							<FormField label="E-mail">
								<Input
									id="email"
									type="text"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="admin@baygon.com"
									required
								/>
							</FormField>
							<FormField label="Senha">
								<Input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="••••••••"
									required
								/>
							</FormField>
							<Button type="submit" disabled={loginMutation.isPending} className="mt-2">
								{loginMutation.isPending ? 'Entrando...' : 'Entrar'}
							</Button>
							<button
								type="button"
								onClick={() => {
									setForgotEmail(email.includes('@') ? email : '');
									setForgotMode(true);
								}}
								className="text-xs text-primary hover:underline text-center cursor-pointer"
							>
								Esqueci minha senha
							</button>
						</form>
					</>
				)}
			</div>
		</div>
	);
}
