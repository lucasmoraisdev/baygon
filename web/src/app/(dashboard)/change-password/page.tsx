'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { fetchAPI } from '@/lib/api';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

export default function ChangePasswordPage() {
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const changeMutation = useMutation({
		mutationFn: () =>
			fetchAPI('/change-password', {
				method: 'POST',
				body: JSON.stringify({
					current_password: currentPassword,
					new_password: newPassword,
				}),
			}),
		onSuccess: (res: { message?: string }) => {
			setErrorMessage(null);
			setSuccessMessage(res.message ?? 'Senha alterada com sucesso!');
			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');
		},
		onError: (err: any) => {
			setSuccessMessage(null);
			setErrorMessage(err.message ?? 'Erro ao alterar senha.');
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setErrorMessage(null);
		setSuccessMessage(null);
		if (newPassword !== confirmPassword) {
			setErrorMessage('A nova senha e a confirmação não conferem.');
			return;
		}
		changeMutation.mutate();
	};

	return (
		<div className="max-w-md mx-auto flex flex-col gap-6 animate-slide-down">
			<div>
				<h1 className="text-3xl text-main">Alterar Senha</h1>
				<p className="text-sm text-muted mt-1">
					Use pelo menos 8 caracteres, com maiúscula, minúscula, número e símbolo.
				</p>
			</div>

			<div className="bg-surface border border-border rounded-xl p-6">
				{successMessage && (
					<div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg px-4 py-3 mb-4">
						{successMessage}
					</div>
				)}
				{errorMessage && (
					<div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
						{errorMessage}
					</div>
				)}

				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<FormField label="Senha Atual">
						<Input
							type="password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							required
							placeholder="••••••••"
						/>
					</FormField>
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
						disabled={changeMutation.isPending}
						className="mt-2"
					>
						{changeMutation.isPending ? 'Salvando...' : 'Atualizar Senha'}
					</Button>
				</form>
			</div>
		</div>
	);
}
