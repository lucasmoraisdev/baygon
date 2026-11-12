'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import {
	SumulaImportResponse,
	SumulaOuroItem,
	SumulaPlayerRow,
	SumulaPreviewResponse,
	SumulaTeamBlock,
} from '@/types/sumula';
import { Season } from '@/types/types';
import {
	useMutation,
	useQueries,
	useQueryClient,
} from '@tanstack/react-query';
import {
	AlertTriangle,
	CheckCircle2,
	Download,
	Eye,
	FileSpreadsheet,
	Image as ImageIcon,
	Plus,
	Send,
	ShieldAlert,
	Trash2,
	Trophy,
	Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const API_URL =
	process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001/api/v1';

type UploadMode = 'image' | 'file';

// Ordem visual das 6 tabelas:
// Linha 1: Time 1, Time 3, Time 5
// Linha 2: Time 2, Time 4, Time 6
const VISUAL_SLOT_ORDER = [1, 3, 5, 2, 4, 6];

export default function AdminSumulasPage() {
	const { user, loading: authLoading } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');
	const queryClient = useQueryClient();

	const [mode, setMode] = useState<UploadMode>('image');
	const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
	const [roundNumber, setRoundNumber] = useState<string>('');
	const [provider, setProvider] = useState<string>('auto');
	const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);
	const [createMissingPlayers, setCreateMissingPlayers] =
		useState<boolean>(true);
	const [registerWinnerAward, setRegisterWinnerAward] =
		useState<boolean>(true);

	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
	const [previewData, setPreviewData] =
		useState<SumulaPreviewResponse | null>(null);
	const [importResult, setImportResult] =
		useState<SumulaImportResponse | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const [seasonsQuery, currentSeasonQuery] = useQueries({
		queries: [
			{
				queryKey: ['seasons'],
				queryFn: () => fetchAPI('/seasons/'),
				enabled: isAdmin,
			},
			{
				queryKey: ['seasons', 'current'],
				queryFn: async () => {
					try {
						return await fetchAPI('/seasons/current');
					} catch {
						return null;
					}
				},
				enabled: isAdmin,
			},
		],
	});

	const seasons: Season[] = seasonsQuery.data ?? [];

	const effectiveSeasonId =
		selectedSeasonId ||
		currentSeasonQuery.data?.id_season?.toString() ||
		seasons[0]?.id_season?.toString() ||
		'';

	useEffect(() => {
		if (selectedFile && mode === 'image') {
			const url = URL.createObjectURL(selectedFile);
			setImagePreviewUrl(url);
			return () => URL.revokeObjectURL(url);
		}
		setImagePreviewUrl(null);
	}, [selectedFile, mode]);

	const handleModeSwitch = (nextMode: UploadMode) => {
		setMode(nextMode);
		setSelectedFile(null);
		setPreviewData(null);
		setImportResult(null);
		setErrorMsg(null);
	};

	const buildFormData = (includeImportFlags: boolean) => {
		if (!selectedFile) {
			throw new Error('Selecione um arquivo antes de continuar.');
		}
		const fd = new FormData();
		fd.append('file', selectedFile);
		if (effectiveSeasonId) {
			fd.append('season_id', effectiveSeasonId);
		}
		if (roundNumber.trim()) {
			fd.append('round_number', roundNumber.trim());
		}
		if (mode === 'image') {
			fd.append('provider', provider);
		}
		if (includeImportFlags) {
			fd.append('overwrite_existing_round', String(overwriteExisting));
			fd.append('create_missing_players', String(createMissingPlayers));
			fd.append('update_player_potes', 'true');
			fd.append(
				'register_round_winner_award',
				String(registerWinnerAward),
			);
		}
		return fd;
	};

	const invalidateAllStats = () => {
		queryClient.invalidateQueries({ queryKey: ['rounds'] });
		queryClient.invalidateQueries({ queryKey: ['teams'] });
		queryClient.invalidateQueries({ queryKey: ['matches'] });
		queryClient.invalidateQueries({ queryKey: ['players'] });
		queryClient.invalidateQueries({ queryKey: ['rankings'] });
	};

	const previewMutation = useMutation({
		mutationFn: async () => {
			const fd = buildFormData(false);
			const endpoint =
				mode === 'image' ? '/sumulas/preview' : '/sumulas/preview-file';
			return fetchAPI(endpoint, { method: 'POST', body: fd });
		},
		onSuccess: (data: SumulaPreviewResponse) => {
			setErrorMsg(null);
			setImportResult(null);
			setPreviewData(data);
		},
		onError: (err: Error) => {
			setErrorMsg(err.message || 'Erro ao analisar súmula.');
		},
	});

	const directImportMutation = useMutation({
		mutationFn: async () => {
			if (!effectiveSeasonId) {
				throw new Error('Selecione uma temporada.');
			}
			const fd = buildFormData(true);
			const endpoint =
				mode === 'image'
					? '/sumulas/import-image'
					: '/sumulas/import-file';
			return fetchAPI(endpoint, { method: 'POST', body: fd });
		},
		onSuccess: (data: SumulaImportResponse) => {
			setErrorMsg(null);
			setImportResult(data);
			invalidateAllStats();
		},
		onError: (err: Error) => {
			setErrorMsg(err.message || 'Erro ao importar súmula.');
		},
	});

	const confirmImportMutation = useMutation({
		mutationFn: async () => {
			if (!previewData) {
				throw new Error('Nenhuma pré-visualização carregada.');
			}
			const payload = {
				season_id: parseInt(effectiveSeasonId, 10) || previewData.season_id,
				round_number: roundNumber.trim()
					? parseInt(roundNumber.trim(), 10)
					: previewData.round_number,
				overwrite_existing_round: overwriteExisting,
				create_missing_players: createMissingPlayers,
				update_player_potes: true,
				register_round_winner_award: registerWinnerAward,
				extra_points_overrides: {},
				header: previewData.header,
				teams: previewData.teams,
				matches: previewData.matches,
				ouros: previewData.ouros,
			};
			return fetchAPI('/sumulas/import', {
				method: 'POST',
				body: JSON.stringify(payload),
			});
		},
		onSuccess: (data: SumulaImportResponse) => {
			setErrorMsg(null);
			setImportResult(data);
			invalidateAllStats();
		},
		onError: (err: Error) => {
			setErrorMsg(err.message || 'Erro ao confirmar importação.');
		},
	});

	const orderedTeamBlocks = useMemo(() => {
		if (!previewData) return [];
		const bySlot = new Map<number, SumulaTeamBlock>();
		for (const t of previewData.teams) {
			bySlot.set(t.slot_index, t);
		}
		return VISUAL_SLOT_ORDER.map(
			(slot) =>
				bySlot.get(slot) ?? {
					slot_index: slot,
					team_name: null,
					is_valid_team: false,
					is_extra_only: false,
					is_champion: false,
					players: [],
				},
		);
	}, [previewData]);

	const updateHeaderField = (field: keyof SumulaPreviewResponse['header'], value: string) => {
		if (!previewData) return;
		setPreviewData({
			...previewData,
			header: {
				...previewData.header,
				[field]:
					field === 'baba_number' ||
					field === 'total_goals' ||
					field === 'total_assists'
						? value
							? parseInt(value, 10) || 0
							: null
						: value || null,
			},
		});
	};

	const updatePlayerInSlot = (
		slotIndex: number,
		playerIdx: number,
		patch: Partial<SumulaPlayerRow>,
	) => {
		if (!previewData) return;
		const teams = previewData.teams.map((t) => {
			if (t.slot_index !== slotIndex) return t;
			const players = t.players.map((p, idx) => {
				if (idx !== playerIdx) return p;
				const updated = { ...p, ...patch };
				updated.total_points =
					(updated.base_points || 0) + (updated.extra_points || 0);
				return updated;
			});
			const nextTeamName =
				t.is_valid_team && players.length > 0
					? players[0].raw_name
					: t.team_name;
			return { ...t, team_name: nextTeamName, players };
		});
		setPreviewData({ ...previewData, teams });
	};

	const toggleChampionSlot = (slotIndex: number) => {
		if (!previewData) return;
		setPreviewData({
			...previewData,
			teams: previewData.teams.map((t) => ({
				...t,
				is_champion:
					t.slot_index === slotIndex ? !t.is_champion : false,
			})),
		});
	};

	const updateMatchField = (
		matchIdx: number,
		field: 'home_team_name' | 'away_team_name' | 'score_home' | 'score_away' | 'camera_name',
		value: string,
	) => {
		if (!previewData) return;
		const matches = previewData.matches.map((m, idx) => {
			if (idx !== matchIdx) return m;
			if (field === 'score_home' || field === 'score_away') {
				return { ...m, [field]: Math.max(0, parseInt(value, 10) || 0) };
			}
			return { ...m, [field]: value };
		});
		setPreviewData({ ...previewData, matches });
	};

	const removeMatch = (matchIdx: number) => {
		if (!previewData) return;
		setPreviewData({
			...previewData,
			matches: previewData.matches.filter((_, idx) => idx !== matchIdx),
		});
	};

	const updateOuro = (idx: number, patch: Partial<SumulaOuroItem>) => {
		if (!previewData) return;
		setPreviewData({
			...previewData,
			ouros: previewData.ouros.map((o, i) =>
				i === idx ? { ...o, ...patch } : o,
			),
		});
	};

	const addOuro = () => {
		if (!previewData) return;
		setPreviewData({
			...previewData,
			ouros: [
				...previewData.ouros,
				{ raw_name: '', player_id: null, player_name: '', count: 1 },
			],
		});
	};

	const removeOuro = (idx: number) => {
		if (!previewData) return;
		setPreviewData({
			...previewData,
			ouros: previewData.ouros.filter((_, i) => i !== idx),
		});
	};

	if (authLoading) return <Loading />;

	if (!isAdmin) {
		return (
			<div className="bg-surface border border-red-500/30 rounded-xl p-8 flex flex-col items-center text-center gap-4 max-w-lg mx-auto mt-12 animate-slide-down">
				<ShieldAlert className="w-12 h-12 text-red-400" />
				<h1 className="text-2xl font-bold text-main">Acesso Restrito</h1>
				<p className="text-sm text-muted">
					Esta página é exclusiva para administradores do sistema.
				</p>
				<Link href="/" className="w-48">
					<Button variant="ghost">Voltar ao Dashboard</Button>
				</Link>
			</div>
		);
	}

	if (seasonsQuery.isLoading || currentSeasonQuery.isLoading) {
		return <Loading />;
	}

	const isBusy =
		previewMutation.isPending ||
		directImportMutation.isPending ||
		confirmImportMutation.isPending;

	return (
		<div className="flex flex-col gap-6 animate-slide-down pb-12">
			{/* Cabeçalho da Página */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl text-main">
						Importar Súmula (Admin)
					</h1>
					<p className="text-sm text-muted mt-1">
						Cadastre partidas, times, jogadores, ouros e pontuações
						a partir de foto da súmula ou planilha CSV / Excel.
					</p>
				</div>

				<div className="flex flex-wrap gap-2">
					<a
						href={`${API_URL}/sumulas/template?format=xlsx&include_example=true`}
						target="_blank"
						rel="noreferrer"
					>
						<Button
							variant="ghost"
							size="sm"
							className="w-auto flex items-center gap-2"
						>
							<Download className="w-4 h-4" />
							Modelo Excel (.xlsx)
						</Button>
					</a>
					<a
						href={`${API_URL}/sumulas/template?format=csv&include_example=true`}
						target="_blank"
						rel="noreferrer"
					>
						<Button
							variant="ghost"
							size="sm"
							className="w-auto flex items-center gap-2"
						>
							<Download className="w-4 h-4" />
							Modelo CSV (.csv)
						</Button>
					</a>
				</div>
			</div>

			{/* Painel de Upload e Configuração */}
			<div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-5">
				{/* Tabs Imagem vs Planilha */}
				<div className="flex gap-2 border-b border-border pb-4">
					<button
						type="button"
						onClick={() => handleModeSwitch('image')}
						className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ${
							mode === 'image'
								? 'bg-primary text-white'
								: 'bg-background/60 text-muted hover:text-main border border-border'
						}`}
					>
						<ImageIcon className="w-4 h-4" />
						Imagem da Súmula (OCR)
					</button>
					<button
						type="button"
						onClick={() => handleModeSwitch('file')}
						className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ${
							mode === 'file'
								? 'bg-primary text-white'
								: 'bg-background/60 text-muted hover:text-main border border-border'
						}`}
					>
						<FileSpreadsheet className="w-4 h-4" />
						Planilha CSV / Excel
					</button>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<FormField label="Temporada">
						<Select
							value={effectiveSeasonId}
							onChange={(e) => setSelectedSeasonId(e.target.value)}
						>
							{seasons.map((s) => (
								<option key={s.id_season} value={s.id_season}>
									Temporada {s.number}{' '}
									{s.is_active ? '(Ativa)' : ''}
								</option>
							))}
						</Select>
					</FormField>

					<FormField label="Baba Nº / Rodada (opcional)">
						<Input
							type="number"
							min={1}
							placeholder="Auto (da súmula ou próxima)"
							value={roundNumber}
							onChange={(e) => setRoundNumber(e.target.value)}
						/>
					</FormField>

					{mode === 'image' ? (
						<FormField label="Motor de Extração (OCR / Visão)">
							<Select
								value={provider}
								onChange={(e) => setProvider(e.target.value)}
							>
								<option value="auto">
									Automático (Ollama/API se config., senão
									RapidOCR)
								</option>
								<option value="rapidocr">
									RapidOCR Local (Open-source Offline)
								</option>
								<option value="ollama">
									Ollama Local (Visão Open-source)
								</option>
								<option value="gemini">Gemini Vision</option>
								<option value="openai">OpenAI Vision</option>
							</Select>
						</FormField>
					) : (
						<div className="flex items-end text-xs text-muted pb-2">
							Aceita arquivos <code>.xlsx</code> (4 abas) ou{' '}
							<code>.csv</code> (separado por <code>,</code> ou{' '}
							<code>;</code>).
						</div>
					)}
				</div>

				{/* Seletor de Arquivo */}
				<div className="flex flex-col md:flex-row gap-4 items-start">
					<label className="flex-1 w-full border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-background/40">
						<Upload className="w-7 h-7 text-primary" />
						<span className="text-sm font-medium text-main">
							{selectedFile
								? selectedFile.name
								: mode === 'image'
									? 'Clique para selecionar a foto da súmula (JPG, PNG, WEBP)'
									: 'Clique para selecionar a planilha (.xlsx ou .csv)'}
						</span>
						<span className="text-xs text-muted">
							{selectedFile
								? `${(selectedFile.size / 1024).toFixed(1)} KB`
								: 'Recomendamos pré-visualizar antes de confirmar quando usar OCR'}
						</span>
						<input
							type="file"
							className="hidden"
							accept={
								mode === 'image'
									? 'image/jpeg,image/png,image/webp'
									: '.csv,.xlsx,.xlsm'
							}
							onChange={(e) => {
								const f = e.target.files?.[0] || null;
								setSelectedFile(f);
								setPreviewData(null);
								setImportResult(null);
								setErrorMsg(null);
							}}
						/>
					</label>

					{imagePreviewUrl && (
						<div className="w-full md:w-64 border border-border rounded-xl overflow-hidden bg-black/30 shrink-0">
							<img
								src={imagePreviewUrl}
								alt="Prévia da súmula"
								className="w-full h-40 object-contain"
							/>
						</div>
					)}
				</div>

				{/* Opções */}
				<div className="flex flex-wrap gap-6 text-sm text-main">
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={overwriteExisting}
							onChange={(e) =>
								setOverwriteExisting(e.target.checked)
							}
						/>
						Sobrescrever rodada se já existir
					</label>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={createMissingPlayers}
							onChange={(e) =>
								setCreateMissingPlayers(e.target.checked)
							}
						/>
						Criar jogadores não cadastrados automaticamente
					</label>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={registerWinnerAward}
							onChange={(e) =>
								setRegisterWinnerAward(e.target.checked)
							}
						/>
						Registrar prêmio do time vencedor da rodada
					</label>
				</div>

				{/* Botões de Ação */}
				<div className="flex flex-wrap gap-3 pt-2">
					<Button
						type="button"
						disabled={!selectedFile || isBusy}
						onClick={() => previewMutation.mutate()}
						className="w-auto flex items-center gap-2"
					>
						<Eye className="w-4 h-4" />
						{previewMutation.isPending
							? 'Analisando...'
							: 'Analisar & Pré-visualizar'}
					</Button>

					<Button
						type="button"
						variant="ghost"
						disabled={!selectedFile || !effectiveSeasonId || isBusy}
						onClick={() => directImportMutation.mutate()}
						className="w-auto flex items-center gap-2"
					>
						<Send className="w-4 h-4" />
						{directImportMutation.isPending
							? 'Cadastrando...'
							: 'Cadastrar Direto (sem revisão)'}
					</Button>
				</div>

				{errorMsg && (
					<div className="bg-red-500/10 border border-red-500/40 text-red-400 rounded-lg p-3 text-sm">
						{errorMsg}
					</div>
				)}
			</div>

			{/* Resultado da Importação */}
			{importResult && (
				<div className="bg-green-500/10 border border-green-500/40 rounded-xl p-6 flex flex-col gap-4">
					<div className="flex items-center justify-between flex-wrap gap-3">
						<div className="flex items-center gap-2 text-green-400 font-semibold text-lg">
							<CheckCircle2 className="w-6 h-6" />
							Súmula da Rodada {importResult.round_number}{' '}
							importada com sucesso!
						</div>
						<Link href={`/rounds/${importResult.round_id}`}>
							<Button size="sm" className="w-auto">
								Ver Rodada #{importResult.round_id} →
							</Button>
						</Link>
					</div>

					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
						<div className="bg-surface/80 border border-border rounded-lg p-3">
							<span className="text-xs text-muted block">
								Times Criados
							</span>
							<strong className="text-lg text-main">
								{importResult.teams_created}
							</strong>
						</div>
						<div className="bg-surface/80 border border-border rounded-lg p-3">
							<span className="text-xs text-muted block">
								Partidas / Eventos
							</span>
							<strong className="text-lg text-main">
								{importResult.matches_created} /{' '}
								{importResult.match_events_created}
							</strong>
						</div>
						<div className="bg-surface/80 border border-border rounded-lg p-3">
							<span className="text-xs text-muted block">
								Jogadores (Vinculados / Novos)
							</span>
							<strong className="text-lg text-main">
								{importResult.players_matched} /{' '}
								{importResult.players_created}
							</strong>
						</div>
						<div className="bg-surface/80 border border-border rounded-lg p-3">
							<span className="text-xs text-muted block">
								Pontuações / Ouros
							</span>
							<strong className="text-lg text-main">
								{importResult.player_scores_created} /{' '}
								{importResult.ouros_registered}
							</strong>
						</div>
					</div>
				</div>
			)}

			{/* Área de Revisão Editável */}
			{previewData && (
				<div className="flex flex-col gap-6">
					{/* Alertas e Validação */}
					{(previewData.warnings.length > 0 ||
						previewData.round_exists) && (
						<div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4 flex flex-col gap-2 text-sm text-yellow-300">
							<div className="flex items-center gap-2 font-semibold">
								<AlertTriangle className="w-4 h-4" />
								Avisos de Validação ({previewData.provider_used})
							</div>
							{previewData.round_exists && (
								<p>
									• A Rodada {previewData.round_number} já
									existe nesta temporada. Marque
									&quot;Sobrescrever rodada&quot; para
									substituí-la.
								</p>
							)}
							{previewData.warnings.map((w, idx) => (
								<p key={idx}>• {w}</p>
							))}
						</div>
					)}

					{/* Cabeçalho da Súmula */}
					<div className="bg-surface border border-border rounded-xl p-6">
						<h2 className="text-lg font-semibold text-main mb-4">
							1. Cabeçalho da Rodada
						</h2>
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
							<FormField label="Data (YYYY-MM-DD)">
								<Input
									value={previewData.header.date ?? ''}
									onChange={(e) =>
										updateHeaderField('date', e.target.value)
									}
									placeholder="2026-11-07"
								/>
							</FormField>
							<FormField label="Baba Nº">
								<Input
									type="number"
									value={
										previewData.header.baba_number ?? ''
									}
									onChange={(e) =>
										updateHeaderField(
											'baba_number',
											e.target.value,
										)
									}
								/>
							</FormField>
							<FormField label="Local">
								<Input
									value={previewData.header.location ?? ''}
									onChange={(e) =>
										updateHeaderField(
											'location',
											e.target.value,
										)
									}
								/>
							</FormField>
							<FormField label="Juiz">
								<Input
									value={previewData.header.referee ?? ''}
									onChange={(e) =>
										updateHeaderField(
											'referee',
											e.target.value,
										)
									}
								/>
							</FormField>
						</div>
					</div>

					{/* 6 Tabelas de Times (Ordem: 1, 3, 5 / 2, 4, 6) */}
					<div className="bg-surface border border-border rounded-xl p-6">
						<div className="flex items-center justify-between flex-wrap gap-2 mb-4">
							<div>
								<h2 className="text-lg font-semibold text-main">
									2. Times &amp; Jogadores (Potes + Pontos
									Extras)
								</h2>
								<p className="text-xs text-muted">
									Linhas 1 a 5 representam os potes. Linha 6 e
									tabelas com apenas 1 jogador são extras (não
									criam time). Ajuste o campo &quot;+
									Extra&quot; (ex: +3) se necessário.
								</p>
							</div>
						</div>

						<div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
							{orderedTeamBlocks.map((block) => (
								<div
									key={block.slot_index}
									className={`border rounded-xl p-4 flex flex-col gap-3 ${
										block.is_champion
											? 'border-yellow-500/60 bg-yellow-500/5'
											: 'border-border bg-background/40'
									}`}
								>
									<div className="flex items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-primary/20 text-primary">
												Slot {block.slot_index}
											</span>
											<strong className="text-sm text-main">
												{block.is_valid_team
													? block.team_name ||
														`Time ${block.slot_index}`
													: block.is_extra_only
														? 'Jogador Extra'
														: 'Vazio'}
											</strong>
										</div>

										{block.is_valid_team && (
											<button
												type="button"
												onClick={() =>
													toggleChampionSlot(
														block.slot_index,
													)
												}
												className={`text-xs px-2 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors ${
													block.is_champion
														? 'bg-yellow-500 text-slate-900 font-semibold'
														: 'border border-border text-muted hover:text-main'
												}`}
											>
												<Trophy className="w-3 h-3" />
												{block.is_champion
													? 'Campeão'
													: 'Marcar Campeão'}
											</button>
										)}
									</div>

									{block.players.length === 0 ? (
										<p className="text-xs text-muted py-4 text-center">
											Sem jogadores nesta tabela.
										</p>
									) : (
										<div className="overflow-x-auto">
											<table className="w-full text-xs">
												<thead>
													<tr className="text-muted border-b border-border text-left">
														<th className="py-1 pr-1">
															Pote
														</th>
														<th className="py-1 pr-1">
															Nome
														</th>
														<th className="py-1 px-1 text-center">
															G
														</th>
														<th className="py-1 px-1 text-center">
															A
														</th>
														<th className="py-1 px-1 text-center">
															V
														</th>
														<th className="py-1 px-1 text-center">
															Base
														</th>
														<th className="py-1 px-1 text-center">
															+Extra
														</th>
														<th className="py-1 pl-1 text-right">
															Total
														</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-border/50">
													{block.players.map(
														(p, pIdx) => (
															<tr key={pIdx}>
																<td className="py-1.5 pr-1 text-muted">
																	{p.pote
																		? `P${p.pote}`
																		: 'EX'}
																</td>
																<td className="py-1.5 pr-1">
																	<input
																		className="w-24 bg-background/80 border border-border rounded px-1.5 py-0.5 text-xs text-main"
																		value={
																			p.raw_name
																		}
																		onChange={(
																			e,
																		) =>
																			updatePlayerInSlot(
																				block.slot_index,
																				pIdx,
																				{
																					raw_name:
																						e
																							.target
																							.value,
																				},
																			)
																		}
																	/>
																	<span
																		className={`block text-[10px] ${
																			p.matched_player_id
																				? 'text-green-400'
																				: 'text-amber-400'
																		}`}
																	>
																		{p.matched_player_id
																			? `DB: ${p.matched_player_name}`
																			: 'Novo'}
																	</span>
																</td>
																<td className="py-1 px-0.5 text-center">
																	<input
																		type="number"
																		className="w-9 bg-background/80 border border-border rounded px-1 py-0.5 text-center text-main"
																		value={
																			p.goals
																		}
																		onChange={(
																			e,
																		) =>
																			updatePlayerInSlot(
																				block.slot_index,
																				pIdx,
																				{
																					goals:
																						parseInt(
																							e
																								.target
																								.value,
																							10,
																						) ||
																						0,
																				},
																			)
																		}
																	/>
																</td>
																<td className="py-1 px-0.5 text-center">
																	<input
																		type="number"
																		className="w-9 bg-background/80 border border-border rounded px-1 py-0.5 text-center text-main"
																		value={
																			p.assists
																		}
																		onChange={(
																			e,
																		) =>
																			updatePlayerInSlot(
																				block.slot_index,
																				pIdx,
																				{
																					assists:
																						parseInt(
																							e
																								.target
																								.value,
																							10,
																						) ||
																						0,
																				},
																			)
																		}
																	/>
																</td>
																<td className="py-1 px-0.5 text-center">
																	<input
																		type="number"
																		className="w-9 bg-background/80 border border-border rounded px-1 py-0.5 text-center text-main"
																		value={
																			p.wins
																		}
																		onChange={(
																			e,
																		) =>
																			updatePlayerInSlot(
																				block.slot_index,
																				pIdx,
																				{
																					wins:
																						parseInt(
																							e
																								.target
																								.value,
																							10,
																						) ||
																						0,
																				},
																			)
																		}
																	/>
																</td>
																<td className="py-1 px-0.5 text-center">
																	<input
																		type="number"
																		className="w-10 bg-background/80 border border-border rounded px-1 py-0.5 text-center text-main"
																		value={
																			p.base_points
																		}
																		onChange={(
																			e,
																		) =>
																			updatePlayerInSlot(
																				block.slot_index,
																				pIdx,
																				{
																					base_points:
																						parseInt(
																							e
																								.target
																								.value,
																							10,
																						) ||
																						0,
																				},
																			)
																		}
																	/>
																</td>
																<td className="py-1 px-0.5 text-center">
																	<input
																		type="number"
																		className="w-10 bg-background/80 border border-primary/40 rounded px-1 py-0.5 text-center text-primary font-semibold"
																		value={
																			p.extra_points
																		}
																		onChange={(
																			e,
																		) =>
																			updatePlayerInSlot(
																				block.slot_index,
																				pIdx,
																				{
																					extra_points:
																						parseInt(
																							e
																								.target
																								.value,
																							10,
																						) ||
																						0,
																				},
																			)
																		}
																	/>
																</td>
																<td className="py-1.5 pl-1 text-right font-bold text-main">
																	{
																		p.total_points
																	}
																</td>
															</tr>
														),
													)}
												</tbody>
											</table>
										</div>
									)}
								</div>
							))}
						</div>
					</div>

					{/* Partidas */}
					<div className="bg-surface border border-border rounded-xl p-6">
						<h2 className="text-lg font-semibold text-main mb-4">
							3. Partidas ({previewData.matches.length})
						</h2>
						{previewData.matches.length === 0 ? (
							<p className="text-sm text-muted">
								Nenhuma partida identificada.
							</p>
						) : (
							<div className="flex flex-col gap-3">
								{previewData.matches.map((m, mIdx) => (
									<div
										key={mIdx}
										className="border border-border rounded-lg p-3 bg-background/40 flex flex-col gap-2"
									>
										<div className="flex flex-wrap items-center justify-between gap-3">
											<div className="flex flex-wrap items-center gap-2 text-sm">
												<span className="text-xs font-semibold text-muted w-8">
													#{m.match_number}
												</span>
												<input
													className="w-28 bg-background/80 border border-border rounded px-2 py-1 text-xs text-main"
													value={m.home_team_name}
													onChange={(e) =>
														updateMatchField(
															mIdx,
															'home_team_name',
															e.target.value,
														)
													}
												/>
												<input
													type="number"
													min={0}
													className="w-12 bg-background/80 border border-border rounded px-1 py-1 text-center text-xs font-bold text-primary"
													value={m.score_home}
													onChange={(e) =>
														updateMatchField(
															mIdx,
															'score_home',
															e.target.value,
														)
													}
												/>
												<span className="text-xs text-muted font-bold">
													X
												</span>
												<input
													type="number"
													min={0}
													className="w-12 bg-background/80 border border-border rounded px-1 py-1 text-center text-xs font-bold text-primary"
													value={m.score_away}
													onChange={(e) =>
														updateMatchField(
															mIdx,
															'score_away',
															e.target.value,
														)
													}
												/>
												<input
													className="w-28 bg-background/80 border border-border rounded px-2 py-1 text-xs text-main"
													value={m.away_team_name}
													onChange={(e) =>
														updateMatchField(
															mIdx,
															'away_team_name',
															e.target.value,
														)
													}
												/>
											</div>

											<div className="flex items-center gap-2 text-xs">
												<span className="text-muted">
													Câmera:
												</span>
												<input
													className="w-24 bg-background/80 border border-border rounded px-2 py-1 text-xs text-main"
													value={m.camera_name ?? ''}
													onChange={(e) =>
														updateMatchField(
															mIdx,
															'camera_name',
															e.target.value,
														)
													}
												/>
												<button
													type="button"
													onClick={() =>
														removeMatch(mIdx)
													}
													className="p-1.5 text-red-400 hover:bg-red-500/10 rounded cursor-pointer"
													title="Remover partida"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											</div>
										</div>

										{m.goals.length > 0 && (
											<div className="flex flex-wrap gap-1.5 pl-8">
												{m.goals.map((g, gIdx) => (
													<span
														key={gIdx}
														className="text-[11px] bg-surface border border-border rounded-full px-2.5 py-0.5 text-main"
													>
														⚽ {g.scorer_name}
														{g.assist_name
															? ` (assist: ${g.assist_name})`
															: ''}
													</span>
												))}
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>

					{/* Ouros */}
					<div className="bg-surface border border-border rounded-xl p-6">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-lg font-semibold text-main">
								4. Ouros ({previewData.ouros.length})
							</h2>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={addOuro}
								className="w-auto flex items-center gap-1"
							>
								<Plus className="w-4 h-4" />
								Adicionar Ouro
							</Button>
						</div>

						{previewData.ouros.length === 0 ? (
							<p className="text-sm text-muted">
								Nenhum ouro registrado.
							</p>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
								{previewData.ouros.map((o, oIdx) => (
									<div
										key={oIdx}
										className="border border-border rounded-lg p-3 flex items-center gap-2 bg-background/40"
									>
										<input
											className="flex-1 min-w-0 bg-background/80 border border-border rounded px-2 py-1 text-xs text-main"
											placeholder="Nome do jogador"
											value={o.raw_name}
											onChange={(e) =>
												updateOuro(oIdx, {
													raw_name: e.target.value,
												})
											}
										/>
										<input
											type="number"
											min={1}
											className="w-12 bg-background/80 border border-border rounded px-1 py-1 text-center text-xs text-main"
											value={o.count}
											onChange={(e) =>
												updateOuro(oIdx, {
													count: Math.max(
														1,
														parseInt(
															e.target.value,
															10,
														) || 1,
													),
												})
											}
										/>
										<button
											type="button"
											onClick={() => removeOuro(oIdx)}
											className="p-1 text-red-400 hover:bg-red-500/10 rounded cursor-pointer"
										>
											<Trash2 className="w-3.5 h-3.5" />
										</button>
									</div>
								))}
							</div>
						)}
					</div>

					{/* Confirmar Cadastro */}
					<div className="flex justify-end gap-3">
						<Button
							type="button"
							variant="ghost"
							onClick={() => setPreviewData(null)}
							className="w-auto"
						>
							Descartar Prévia
						</Button>
						<Button
							type="button"
							disabled={isBusy || !effectiveSeasonId}
							onClick={() => confirmImportMutation.mutate()}
							className="w-auto flex items-center gap-2"
						>
							<CheckCircle2 className="w-4 h-4" />
							{confirmImportMutation.isPending
								? 'Salvando no Banco...'
								: 'Confirmar & Cadastrar Rodada'}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
