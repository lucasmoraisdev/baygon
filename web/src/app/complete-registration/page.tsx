'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const API_URL =
	process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001/api/v1';

function CompleteRegistrationForm() {
	const searchParams = useSearchParams();
	const tokenFromUrl = searchParams.get('setup_token') ?? '';

	const [setupToken, setSetupToken] = useState(tokenFromUrl);
	const [temporaryPassword, setTemporaryPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [completedUser, setCompletedUser] = useState<{
		username: string;
		email: string;
	} | null>(null);

	useEffect(() => {
		if (tokenFromUrl) {
			setSetupToken(tokenFromUrl);
		}
	}, [tokenFromUrl]);

	const mutation = useMutation({
		mutationFn: async () => {
			if (newPassword !== confirmPassword) {
				throw new Error('As senhas não conferem.');
			}
			const resp = await fetch(
				`${API_URL}/users/complete-registration`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						setup_token: setupToken.trim(),
						temporary_password: temporaryPassword,
						new_password: newPassword,
					}),
				},
			);
			const data = await resp.json().catch(() => ({}));
			if (!resp.ok) {
				throw new Error(
					data.detail || 'Não foi possível concluir o cadastro.',
				);
			}
			return data;
		},
		onSuccess: (data) => {
			setCompletedUser(data.user ?? { username: '', email: '' });
		},
	});

	if (completedUser) {
		return (
			<div className="bg-surface border border-green-500/30 rounded-xl p-8 w-full max-w-md flex flex-col items-center text-center gap-4">
				<CheckCircle2 className="w-12 h-12 text-green-400" />
				<h2 className="text-xl font-semibold text-main">
					Cadastro concluído!
				</h2>
				<p className="text-sm text-muted">
					Sua conta{' '}
					{completedUser.username ? (
						<strong className="text-main">
							@{completedUser.username}
						</strong>
					) : (
						''
					)}{' '}
					foi ativada com sucesso. Agora você já pode fazer login.
				</p>
				<Link href="/login" className="w-full">
					<Button>Ir para o Login</Button>
				</Link>
			</div>
		);
	}

	if (!tokenFromUrl) {
		return (
			<div className="bg-surface border border-border rounded-xl p-8 w-full max-w-md flex flex-col items-center text-center gap-4">
				<div className="text-2xl font-bold text-primary">Baygon</div>
				<h2 className="text-xl font-semibold text-main">
					Cadastro apenas por convite
				</h2>
				<p className="text-sm text-muted">
					O acesso à conclusão de cadastro é exclusivo pelo link de
					convite enviado por um administrador.
				</p>
				<Link href="/login" className="w-full">
					<Button variant="ghost">Voltar para o Login</Button>
				</Link>
			</div>
		);
	}

	return (
		<div className="bg-surface border border-border rounded-xl p-8 w-full max-w-md shadow-[0_10px_25px_rgba(0,0,0,0.5)]">
			<div className="text-center text-2xl font-bold text-primary mb-4">
				Baygon
			</div>
			<h2 className="text-xl font-semibold text-main mb-1">
				Concluir Cadastro
			</h2>
			<p className="text-sm text-muted mb-6">
				Informe a senha temporária recebida no convite e defina sua
				nova senha.
			</p>

			{mutation.isError && (
				<div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
					{(mutation.error as Error)?.message}
				</div>
			)}

			<form
				onSubmit={(e) => {
					e.preventDefault();
					mutation.mutate();
				}}
				className="flex flex-col gap-4"
			>
				<FormField label="Senha Temporária">
					<Input
						type="password"
						value={temporaryPassword}
						onChange={(e) => setTemporaryPassword(e.target.value)}
						placeholder="Senha recebida no convite"
						required
					/>
				</FormField>

				<FormField label="Nova Senha">
					<Input
						type="password"
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
						placeholder="Mín. 8 caracteres (Aa1!)"
						required
					/>
					<span className="text-[11px] text-muted mt-1 block">
						Mínimo de 8 caracteres com maiúscula, minúscula, número
						e símbolo.
					</span>
				</FormField>

				<FormField label="Confirmar Nova Senha">
					<Input
						type="password"
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						placeholder="Repita a nova senha"
						required
					/>
				</FormField>

				<Button
					type="submit"
					disabled={mutation.isPending}
					className="mt-2"
				>
					{mutation.isPending ? 'Ativando...' : 'Ativar Conta'}
				</Button>
			</form>

			<div className="mt-5 pt-4 border-t border-border text-center">
				<Link
					href="/login"
					className="text-xs text-muted hover:text-primary transition-colors"
				>
					← Voltar para o Login
				</Link>
			</div>
		</div>
	);
}

export default function CompleteRegistrationPage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-background px-4">
			<Suspense
				fallback={
					<div className="text-muted text-sm">Carregando...</div>
				}
			>
				<CompleteRegistrationForm />
			</Suspense>
		</div>
	);
}
