'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { fetchAPI } from '@/lib/api';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function ResetPasswordForm() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const token = searchParams.get('token') ?? '';

	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	const resetMutation = useMutation({
		mutationFn: () =>
			fetchAPI('/reset-password', {
				method: 'POST',
				body: JSON.stringify({
					token,
					new_password: newPassword,
				}),
			}),
		onSuccess: () => {
			setErrorMessage(null);
			setDone(true);
		},
		onError: (err: any) => {
			setErrorMessage(err.message ?? 'Não foi possível redefinir a senha.');
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setErrorMessage(null);
		if (!token) {
			setErrorMessage('Token de redefinição ausente ou inválido.');
			return;
		}
		if (newPassword !== confirmPassword) {
			setErrorMessage('As senhas não conferem.');
			return;
		}
		resetMutation.mutate();
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background px-4">
			<div className="bg-surface border border-border rounded-xl p-8 w-full max-w-sm shadow-[0_10px_25px_rgba(0,0,0,0.5)]">
				<div className="text-center text-2xl font-bold text-primary mb-6">
					Baygon
				</div>
				<h2 className="text-xl font-semibold text-main mb-1">
					Redefinir Senha
				</h2>
				<p className="text-sm text-muted mb-6">
					Defina uma nova senha forte (mínimo 8 caracteres, maiúscula, minúscula, número e símbolo).
				</p>

				{errorMessage && (
					<div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
						{errorMessage}
					</div>
				)}

				{done ? (
					<div className="flex flex-col gap-4">
						<div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg px-4 py-3">
							Senha redefinida com sucesso! Você já pode fazer login.
						</div>
						<Button onClick={() => router.push('/login')}>
							Ir para o Login
						</Button>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<FormField label="Nova Senha">
							<Input
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								required
								placeholder="••••••••"
							/>
						</FormField>
						<FormField label="Confirmar Nova Senha">
							<Input
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
								placeholder="••••••••"
							/>
						</FormField>
						<Button
							type="submit"
							disabled={resetMutation.isPending}
							className="mt-2"
						>
							{resetMutation.isPending ? 'Redefinindo...' : 'Salvar Nova Senha'}
						</Button>
						<Link
							href="/login"
							className="text-center text-xs text-muted hover:text-main mt-1"
						>
							Voltar ao login
						</Link>
					</form>
				)}
			</div>
		</div>
	);
}

export default function ResetPasswordPage() {
	return (
		<Suspense fallback={<Loading />}>
			<ResetPasswordForm />
		</Suspense>
	);
}
