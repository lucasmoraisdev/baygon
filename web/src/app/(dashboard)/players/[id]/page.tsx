'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import SeasonChart from '@/components/SeasonChart';
import { StatCard } from '@/components/StatCard';
import SuspendModal from '@/components/SuspendModal';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { PlayerProfile } from '@/types/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

const AWARD_MAP: Record<string, string> = {
	time_vencedor_rodada: 'Campeão da Rodada',
	bola_cheia: 'MVP',
	bola_murcha: 'Pior Jogador',
	gol_rodada: 'Gol da Rodada',
	defesa_rodada: 'Defesa da Rodada',
	drible_rodada: 'Drible da Rodada',
	inacreditavel: 'Inacreditável',
	goleiro_menos_vazado: 'Goleiro Menos Vazado',
	roleta: 'Roleta',
};

export default function PlayerProfilePage() {
	const params = useParams();
	const router = useRouter();
	const { user } = useAuth();
	const queryClient = useQueryClient();
	const playerId = params.id as string;
	const isAdmin = user?.role === 'admin';

	const [showAdminPanel, setShowAdminPanel] = useState(false);
	const [showSuspendModal, setShowSuspendModal] = useState(false);
	const [fineAmount, setFineAmount] = useState(0);
	const [observations, setObservations] = useState('');

	const {
		data: player,
		isLoading,
		isError,
	} = useQuery<PlayerProfile>({
		queryKey: ['player', playerId],
		queryFn: () => fetchAPI(`/players/${playerId}/profile`),
	});

	const { data: playerStatus } = useQuery({
		queryKey: ['player-status', playerId],
		queryFn: () => fetchAPI(`/players/${playerId}/status`),
		enabled: isAdmin,
	});

	const { data: adminActionsHistory = [] } = useQuery<any[]>({
		queryKey: ['player-actions', playerId],
		queryFn: () => fetchAPI(`/players/${playerId}/admin/actions`),
		enabled: isAdmin,
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ['player', playerId] });
		queryClient.invalidateQueries({
			queryKey: ['player-status', playerId],
		});
		queryClient.invalidateQueries({
			queryKey: ['player-actions', playerId],
		});
	};

	const adminMutation = useMutation({
		mutationFn: ({ action, body }: { action: string; body?: object }) =>
			fetchAPI(`/players/${playerId}/admin/${action}`, {
				method: 'POST',
				body: body ? JSON.stringify(body) : undefined,
			}),
		onSuccess: (_, { action }) => {
			invalidate();
			alert(`Ação "${action}" executada com sucesso!`);
		},
		onError: (err: any) => {
			alert(`Erro: ${err.message ?? 'Falha ao executar ação'}`);
		},
	});

	const suspendMutation = useMutation({
		mutationFn: ({ type, value }: { type: string; value: number }) =>
			fetchAPI(`/players/${playerId}/admin/suspend`, {
				method: 'POST',
				body: JSON.stringify({ suspension_type: type, value }),
			}),
		onSuccess: () => {
			invalidate();
			setShowSuspendModal(false);
			alert('Jogador suspenso com sucesso!');
		},
		onError: (err: any) => {
			alert(`Erro: ${err.message ?? 'Falha ao suspender'}`);
		},
	});

	if (isLoading) return <Loading />;
	if (isError || !player)
		return (
			<div className="flex flex-col gap-4 p-4">
				<Button
					variant="ghost"
					onClick={() => router.back()}
					className="w-auto"
				>
					← Voltar
				</Button>
				<div className="text-red-400">
					{isError
						? 'Erro ao carregar perfil.'
						: 'Jogador não encontrado.'}
				</div>
			</div>
		);

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<Button
				variant="ghost"
				onClick={() => router.back()}
				className="w-auto self-start"
			>
				← Voltar
			</Button>

			<div className="bg-surface border border-border rounded-xl p-6">
				<div className="flex items-start justify-between gap-4 flex-wrap">
					<div className="flex items-center gap-4">
						<div className="w-16 h-16 rounded-full bg-primary/20 text-primary text-2xl font-bold flex items-center justify-center shrink-0">
							{player.nome.charAt(0).toUpperCase()}
						</div>
						<div className="flex flex-col gap-1">
							<h1 className="text-2xl font-bold text-main">
								{player.nome}
							</h1>
							{player.apelido && (
								<p className="text-muted text-sm italic">
									"{player.apelido}"
								</p>
							)}
							<div className="flex gap-2 flex-wrap mt-1">
								{player.posicao && (
									<span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
										{player.posicao
											.charAt(0)
											.toUpperCase() +
											player.posicao.slice(1)}
									</span>
								)}
								{player.pe && (
									<span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
										Pé: {player.pe}
									</span>
								)}
								{player.potes && (
									<span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
										Pote {player.potes}
									</span>
								)}
								<span
									className={`text-xs px-2 py-0.5 rounded-full ${player.is_guest ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}
								>
									{player.is_guest
										? 'Convidado'
										: 'Mensalista'}
								</span>
							</div>
						</div>
					</div>
					{isAdmin && (
						<Button
							variant="ghost"
							onClick={() => setShowAdminPanel(!showAdminPanel)}
							className="w-auto"
						>
							{showAdminPanel
								? 'Fechar Painel Admin'
								: 'Abrir Painel Admin'}
						</Button>
					)}
				</div>

				{(player.email || player.telefone) && (
					<div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
						{player.email && (
							<div className="flex flex-col gap-0.5">
								<label className="text-xs text-muted">
									Email
								</label>
								<p className="text-sm text-main">
									{player.email}
								</p>
							</div>
						)}
						{player.telefone && (
							<div className="flex flex-col gap-0.5">
								<label className="text-xs text-muted">
									Telefone
								</label>
								<p className="text-sm text-main">
									{player.telefone}
								</p>
							</div>
						)}
					</div>
				)}
			</div>

			{isAdmin && showAdminPanel && (
				<div className="bg-surface/50 border border-border rounded-xl p-6 flex flex-col gap-6">
					<h2 className="text-xl font-semibold">
						Painel Administrativo
					</h2>

					{playerStatus && (
						<div className="bg-surface border border-border rounded-xl p-4">
							<h3 className="font-semibold mb-3">Status Atual</h3>
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted">
										Bloqueado:
									</span>
									<span
										className={
											playerStatus.is_blocked
												? 'text-red-400 font-semibold'
												: 'text-green-400 font-semibold'
										}
									>
										{playerStatus.is_blocked
											? 'SIM'
											: 'NÃO'}
									</span>
								</div>
								{playerStatus.suspension && (
									<>
										{playerStatus.suspension
											.is_indefinite ? (
											<div className="flex items-center justify-between">
												<span className="text-sm text-muted">
													Suspensão:
												</span>
												<span className="text-red-400 font-semibold">
													Indefinida
												</span>
											</div>
										) : playerStatus.suspension
												.suspension_matches ? (
											<div className="flex items-center justify-between">
												<span className="text-sm text-muted">
													Jogos restantes:
												</span>
												<span className="text-yellow-400 font-semibold">
													{
														playerStatus.suspension
															.suspension_matches
													}
												</span>
											</div>
										) : (
											<>
												<div className="flex items-center justify-between">
													<span className="text-sm text-muted">
														Suspenso até:
													</span>
													<span className="text-yellow-400 font-semibold">
														{new Date(
															playerStatus
																.suspension
																.suspended_until,
														).toLocaleDateString(
															'pt-BR',
														)}
													</span>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-sm text-muted">
														Dias restantes:
													</span>
													<span className="text-yellow-400 font-semibold">
														{
															playerStatus
																.suspension
																.days_remaining
														}
													</span>
												</div>
											</>
										)}
										<Button
											variant="ghost"
											className="w-auto mt-2 border-green-500/50 text-green-400 hover:bg-green-500/10"
											onClick={() =>
												adminMutation.mutate({
													action: 'unsuspend',
												})
											}
											disabled={adminMutation.isPending}
										>
											Remover Suspensão Ativa
										</Button>
									</>
								)}
							</div>
						</div>
					)}

					<div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
						<div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
							<h3 className="font-semibold">
								Gerenciar Suspensão
							</h3>
							<p className="text-sm text-muted">
								Aplique penalidades de suspensão
							</p>
							<Button
								variant="danger"
								onClick={() => setShowSuspendModal(true)}
								disabled={adminMutation.isPending}
							>
								Configurar Suspensão
							</Button>
						</div>

						<div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
							<h3 className="font-semibold">Aplicar Multa</h3>
							<FormField label="Valor (R$)">
								<Input
									type="number"
									min="0"
									step="0.01"
									value={fineAmount}
									onChange={(e) =>
										setFineAmount(
											parseFloat(e.target.value),
										)
									}
								/>
							</FormField>
							<Button
								variant="ghost"
								className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
								onClick={() =>
									adminMutation.mutate({
										action: 'fine',
										body: { fine_amount: fineAmount },
									})
								}
								disabled={adminMutation.isPending}
							>
								Aplicar Multa de R$ {fineAmount.toFixed(2)}
							</Button>
						</div>

						<div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
							<h3 className="font-semibold">Observações</h3>
							<textarea
								value={observations}
								onChange={(e) =>
									setObservations(e.target.value)
								}
								placeholder="Digite suas observações..."
								className="w-full px-3 py-2.5 bg-background/80 border border-border rounded-md text-main text-sm focus:outline-none focus:border-primary transition-colors resize-none h-24"
							/>
							<Button
								variant="ghost"
								onClick={() =>
									adminMutation.mutate({
										action: 'observe',
										body: { observations },
									})
								}
								disabled={adminMutation.isPending}
							>
								Salvar Observações
							</Button>
						</div>

						<div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
							<h3 className="font-semibold">
								Controle de Acesso
							</h3>
							<Button
								variant="danger"
								onClick={() =>
									adminMutation.mutate({ action: 'block' })
								}
								disabled={adminMutation.isPending}
							>
								Bloquear Acesso
							</Button>
							<Button
								variant="ghost"
								className="border-green-500/50 text-green-400 hover:bg-green-500/10"
								onClick={() =>
									adminMutation.mutate({ action: 'unblock' })
								}
								disabled={adminMutation.isPending}
							>
								Desbloquear Acesso
							</Button>
						</div>
					</div>

					{adminActionsHistory.length > 0 && (
						<div className="bg-surface border border-border rounded-xl p-4">
							<h3 className="font-semibold mb-3">
								Histórico de Ações
							</h3>
							<div className="max-h-64 overflow-y-auto flex flex-col divide-y divide-border">
								{adminActionsHistory.map((action, idx) => (
									<div
										key={idx}
										className="py-2 first:pt-0 last:pb-0"
									>
										<div className="flex items-center justify-between">
											<span className="text-sm font-medium text-main">
												{action.action_type}
											</span>
											<span className="text-xs text-muted">
												{new Date(
													action.created_at,
												).toLocaleDateString('pt-BR')}
											</span>
										</div>
										{action.description && (
											<p className="text-xs text-muted mt-1">
												{action.description}
											</p>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
				<div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3 flex-1">
					<StatCard
						label="Partidas"
						value={player.stats.total_matches}
					/>
					<StatCard
						label="Vitórias"
						value={player.stats.total_wins}
						color="green"
					/>
					<StatCard
						label="Derrotas"
						value={player.stats.total_losses}
						color="red"
					/>
					<StatCard
						label="Empates"
						value={player.stats.total_draws}
						color="yellow"
					/>
					<StatCard
						label="Gols"
						value={player.stats.total_goals}
						color="blue"
					/>
					<StatCard
						label="Assistências"
						value={player.stats.total_assists}
						color="purple"
					/>
					<StatCard
						label="Prêmios"
						value={player.stats.total_awards}
						color="orange"
					/>
					<StatCard
						label="Temporadas"
						value={player.stats.total_seasons}
					/>
				</div>

				<div className="bg-surface border border-border rounded-xl p-6 lg:w-64 shrink-0">
					<h2 className="text-lg font-semibold mb-4">Resumo</h2>
					<div className="flex flex-col gap-3">
						{[
							{
								label: 'Taxa de Vitória',
								value:
									player.stats.total_matches > 0
										? `${((player.stats.total_wins / player.stats.total_matches) * 100).toFixed(1)}%`
										: '0%',
							},
							{
								label: 'Gols por Partida',
								value:
									player.stats.total_matches > 0
										? (
												player.stats.total_goals /
												player.stats.total_matches
											).toFixed(2)
										: '0',
							},
							{
								label: 'Assist. por Part.',
								value:
									player.stats.total_matches > 0
										? (
												player.stats.total_assists /
												player.stats.total_matches
											).toFixed(2)
										: '0',
							},
							{ label: 'Times', value: player.teams.length },
						].map(({ label, value }) => (
							<div
								key={label}
								className="flex items-center justify-between"
							>
								<span className="text-sm text-muted">
									{label}
								</span>
								<span className="text-sm font-semibold text-main">
									{value}
								</span>
							</div>
						))}
					</div>
				</div>
			</div>

			{player.season_stats.length > 0 && (
				<div className="bg-surface border border-border rounded-xl p-6">
					<h2 className="text-xl font-semibold mb-4">
						Estatísticas por Temporada
					</h2>
					<div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 mb-6">
						<SeasonChart
							stats={player.season_stats}
							dataKey="total_matches"
							label="Partidas"
							color="#3b82f6"
						/>
						<SeasonChart
							stats={player.season_stats}
							dataKey="total_goals"
							label="Gols"
							color="#10b981"
						/>
						<SeasonChart
							stats={player.season_stats}
							dataKey="total_assists"
							label="Assistências"
							color="#f59e0b"
						/>
						<SeasonChart
							stats={player.season_stats}
							dataKey="total_wins"
							label="Vitórias"
							color="#8b5cf6"
						/>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border">
									<th className="text-left py-2 text-muted font-medium">
										Temporada
									</th>
									<th className="text-center py-2 text-muted font-medium">
										P
									</th>
									<th className="text-center py-2 text-muted font-medium">
										V
									</th>
									<th className="text-center py-2 text-muted font-medium">
										D
									</th>
									<th className="text-center py-2 text-muted font-medium">
										E
									</th>
									<th className="text-center py-2 text-muted font-medium">
										G
									</th>
									<th className="text-center py-2 text-muted font-medium">
										A
									</th>
								</tr>
							</thead>
							<tbody>
								{player.season_stats.map((s) => (
									<tr
										key={s.season_id}
										className="border-b border-border/50"
									>
										<td className="py-2 text-main">
											{s.season_name ||
												`Temporada ${s.season_id}`}
										</td>
										<td className="text-center py-2 text-muted">
											{s.total_matches}
										</td>
										<td className="text-center py-2 text-green-400">
											{s.total_wins}
										</td>
										<td className="text-center py-2 text-red-400">
											{s.total_losses}
										</td>
										<td className="text-center py-2 text-yellow-400">
											{s.total_draws}
										</td>
										<td className="text-center py-2 text-blue-400">
											{s.total_goals}
										</td>
										<td className="text-center py-2 text-purple-400">
											{s.total_assists}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{player.teams.length > 0 && (
				<div className="bg-surface border border-border rounded-xl p-6">
					<h2 className="text-xl font-semibold mb-4">Times</h2>
					<div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
						{player.teams.map((team) => (
							<Link
								key={team.id_team}
								href={`/teams/${team.id_team}`}
								className="bg-surface/50 border border-border rounded-lg p-3 hover:border-primary transition-colors"
							>
								<p className="font-semibold text-main text-sm">
									{team.name}
								</p>
								<p className="text-xs text-primary mt-1">
									Ver detalhes →
								</p>
							</Link>
						))}
					</div>
				</div>
			)}

			{/* Prêmios */}
			{player.awards.length > 0 && (
				<div className="bg-surface border border-border rounded-xl p-6">
					<h2 className="text-xl font-semibold mb-4">
						Prêmios ({player.awards.length})
					</h2>
					<div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
						{player.awards.map((award, idx) => (
							<div
								key={idx}
								className="bg-surface/50 border border-border rounded-xl p-3 flex flex-col items-center gap-2 text-center"
							>
								<span className="text-2xl">🏆</span>
								<span className="text-xs text-muted">
									{AWARD_MAP[award.event_type] ??
										award.event_type}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			<SuspendModal
				isOpen={showSuspendModal}
				onClose={() => setShowSuspendModal(false)}
				onConfirm={(type, value) =>
					suspendMutation.mutate({ type, value })
				}
			/>
		</div>
	);
}
