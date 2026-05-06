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

	const loginMutation = useMutation({
		mutationFn: async () => {
			const response = await fetchAPI('/login', {
				method: 'POST',
				body: JSON.stringify({ email, password }),
			});
			if (response.access_token) {
				const userResp = await fetchAPI('/users/me', {
					headers: { Authorization: `Bearer ${response.access_token}` },
				});
				login(response.access_token, response.refresh_token ?? null, userResp);
			}
		},
	});

	return (
		<div className="min-h-screen flex items-center justify-center bg-background px-4">
			<div className="bg-surface border border-border rounded-xl p-8 w-full max-w-sm shadow-[0_10px_25px_rgba(0,0,0,0.5)]">
				<div className="text-center text-2xl font-bold text-primary mb-6">Baygon</div>
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
				</form>
			</div>
		</div>
	);
}
