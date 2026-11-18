'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
	Users,
	Trophy,
	Target,
	Sparkles,
	Swords,
	TrendingUp,
	CheckCircle2,
	Flame,
	Shield,
	ChevronRight,
	Info,
	X,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';

export interface PartnershipPair {
	partner_id: number;
	partner_name: string;
	partner_apelido: string;
	partner_posicao: string;
	partner_pe?: string;
	matches_together: number;
	wins: number;
	draws: number;
	losses: number;
	win_rate: number;
	goals_for: number;
	goals_against: number;
	player_goals: number;
	player_assists: number;
	partner_goals: number;
	partner_assists: number;
	player_assisted_by_partner: number;
	partner_assisted_by_player: number;
	mutual_goals: number;
}

export interface PartnershipTrio {
	id: string;
	partner_1: {
		id_player: number;
		name: string;
		apelido: string;
		posicao: string;
	};
	partner_2: {
		id_player: number;
		name: string;
		apelido: string;
		posicao: string;
	};
	matches_together: number;
	wins: number;
	draws: number;
	losses: number;
	win_rate: number;
	goals_for: number;
	goals_against: number;
	player_goals: number;
	player_assists: number;
	partner_1_goals: number;
	partner_1_assists: number;
	partner_2_goals: number;
	partner_2_assists: number;
	total_trio_goals: number;
	total_trio_assists: number;
	mutual_trio_goals?: number;
}

export interface PartnershipData {
	player_id: number;
	player_name: string;
	player_apelido?: string;
	season_id?: number | string | null;
	total_matches_evaluated: number;
	pairs: PartnershipPair[];
	trios: PartnershipTrio[];
}

interface TreemapNode<T> {
	item: T;
	x: number;
	y: number;
	w: number;
	h: number;
}

// Algoritmo Squarified Treemap (Bruls et al.)
function squarify<T extends { value: number }>(
	items: T[],
	x: number = 0,
	y: number = 0,
	w: number = 100,
	h: number = 100,
): TreemapNode<T>[] {
	if (items.length === 0) return [];
	if (items.length === 1) {
		return [{ item: items[0], x, y, w, h }];
	}

	const total = items.reduce((acc, it) => acc + it.value, 0);
	if (total <= 0) return [];

	const sorted = [...items].sort((a, b) => b.value - a.value);
	const area = w * h;
	const normalized = sorted.map((it) => ({
		...it,
		normalizedValue: (it.value / total) * area,
	}));

	const result: TreemapNode<T>[] = [];

	function worst(row: typeof normalized, length: number): number {
		if (row.length === 0) return Infinity;
		const rowArea = row.reduce((acc, r) => acc + r.normalizedValue, 0);
		const side = rowArea / length;
		if (side <= 0) return Infinity;

		let maxWorst = 0;
		for (const r of row) {
			const otherSide = r.normalizedValue / side;
			const ratio = Math.max(side / otherSide, otherSide / side);
			if (ratio > maxWorst) maxWorst = ratio;
		}
		return maxWorst;
	}

	function layoutRow(
		row: typeof normalized,
		containerW: number,
		containerH: number,
		containerX: number,
		containerY: number,
		vertical: boolean,
	) {
		const rowArea = row.reduce((acc, r) => acc + r.normalizedValue, 0);
		const rowLength = vertical ? rowArea / containerH : rowArea / containerW;

		let offset = 0;
		for (const item of row) {
			const itemLength = item.normalizedValue / rowLength;
			if (vertical) {
				result.push({
					item: item as unknown as T,
					x: containerX,
					y: containerY + offset,
					w: rowLength,
					h: itemLength,
				});
				offset += itemLength;
			} else {
				result.push({
					item: item as unknown as T,
					x: containerX + offset,
					y: containerY,
					w: itemLength,
					h: rowLength,
				});
				offset += itemLength;
			}
		}
	}

	function recurse(
		remaining: typeof normalized,
		currX: number,
		currY: number,
		currW: number,
		currH: number,
	) {
		if (remaining.length === 0) return;
		if (remaining.length === 1) {
			result.push({
				item: remaining[0] as unknown as T,
				x: currX,
				y: currY,
				w: currW,
				h: currH,
			});
			return;
		}

		const vertical = currW >= currH;
		const side = vertical ? currH : currW;

		let row: typeof normalized = [];
		let i = 0;

		while (i < remaining.length) {
			const candidate = [...row, remaining[i]];
			if (row.length === 0 || worst(candidate, side) <= worst(row, side)) {
				row = candidate;
				i++;
			} else {
				break;
			}
		}

		const rowArea = row.reduce((acc, r) => acc + r.normalizedValue, 0);
		const rowLength = rowArea / side;

		layoutRow(row, currW, currH, currX, currY, vertical);

		const nextRemaining = remaining.slice(i);
		if (nextRemaining.length > 0) {
			if (vertical) {
				recurse(
					nextRemaining,
					currX + rowLength,
					currY,
					currW - rowLength,
					currH,
				);
			} else {
				recurse(
					nextRemaining,
					currX,
					currY + rowLength,
					currW,
					currH - rowLength,
				);
			}
		}
	}

	recurse(normalized, x, y, w, h);
	return result;
}

// Estilos de cor baseados na taxa de vitória
function getWinRateTheme(winRate: number) {
	if (winRate >= 60) {
		return {
			bg: 'from-emerald-950/60 via-emerald-900/40 to-emerald-950/50',
			border: 'border-emerald-500/40 hover:border-emerald-400',
			badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
			accentText: 'text-emerald-400',
			glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
		};
	}
	if (winRate >= 45) {
		return {
			bg: 'from-blue-950/60 via-blue-900/40 to-blue-950/50',
			border: 'border-blue-500/40 hover:border-blue-400',
			badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
			accentText: 'text-blue-400',
			glow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]',
		};
	}
	if (winRate >= 30) {
		return {
			bg: 'from-amber-950/60 via-amber-900/40 to-amber-950/50',
			border: 'border-amber-500/40 hover:border-amber-400',
			badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
			accentText: 'text-amber-400',
			glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
		};
	}
	return {
		bg: 'from-rose-950/60 via-rose-900/40 to-rose-950/50',
		border: 'border-rose-500/40 hover:border-rose-400',
		badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
		accentText: 'text-rose-400',
		glow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]',
	};
}

export function PartnershipTreemap({
	data,
	playerName,
	isLoading = false,
}: {
	data?: PartnershipData | null;
	playerName?: string;
	isLoading?: boolean;
}) {
	const [viewMode, setViewMode] = useState<'pairs' | 'trios'>('pairs');
	const [selectedPair, setSelectedPair] = useState<PartnershipPair | null>(
		null,
	);
	const [selectedTrio, setSelectedTrio] = useState<PartnershipTrio | null>(
		null,
	);

	const pairs = data?.pairs ?? [];
	const trios = data?.trios ?? [];

	// Treemap nodes para duplas
	const pairNodes = useMemo(() => {
		if (pairs.length === 0) return [];
		const mapped = pairs.map((p) => ({
			...p,
			value: p.matches_together,
		}));
		return squarify(mapped);
	}, [pairs]);

	// Treemap nodes para trios
	const trioNodes = useMemo(() => {
		if (trios.length === 0) return [];
		const mapped = trios.map((t) => ({
			...t,
			value: t.matches_together,
		}));
		return squarify(mapped);
	}, [trios]);

	if (isLoading) {
		return (
			<div className="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center justify-center min-h-[350px] gap-3">
				<div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
				<span className="text-sm text-muted">Carregando análise de parcerias...</span>
			</div>
		);
	}

	const hasData = viewMode === 'pairs' ? pairs.length > 0 : trios.length > 0;

	return (
		<div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-5">
			{/* Cabeçalho do Widget */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-border">
				<div>
					<div className="flex items-center gap-2">
						<h3 className="text-base sm:text-lg font-bold text-main flex items-center gap-2">
							<Sparkles className="w-5 h-5 text-primary" />
							Química & Parcerias em Campo
						</h3>
						<span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
							Treemap
						</span>
					</div>
					<p className="text-xs text-muted mt-1">
						Relação de jogos, sinergia ofensiva e aproveitamento ao lado de cada companheiro de time.
					</p>
				</div>

				{/* Switcher Duplas / Trios */}
				<div className="flex items-center bg-background border border-border rounded-xl p-1 self-start sm:self-auto">
					<button
						type="button"
						onClick={() => setViewMode('pairs')}
						className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							viewMode === 'pairs'
								? 'bg-primary text-white shadow-sm'
								: 'text-muted hover:text-main'
						}`}
					>
						<Users className="w-3.5 h-3.5" />
						<span>Duplas ({pairs.length})</span>
					</button>

					<button
						type="button"
						onClick={() => setViewMode('trios')}
						className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
							viewMode === 'trios'
								? 'bg-primary text-white shadow-sm'
								: 'text-muted hover:text-main'
						}`}
					>
						<Flame className="w-3.5 h-3.5" />
						<span>Trios ({trios.length})</span>
					</button>
				</div>
			</div>

			{/* Informações de apoio / Dica */}
			<div className="flex items-center justify-between text-xs text-muted bg-background/60 border border-border rounded-xl px-3.5 py-2">
				<span className="flex items-center gap-1.5">
					<Info className="w-3.5 h-3.5 text-primary shrink-0" />
					O tamanho de cada retângulo reflete o <strong>volume de jogos juntos</strong>. A cor indica o <strong>aproveitamento (% vitórias)</strong>.
				</span>
				<span className="hidden md:inline text-[11px] font-medium text-muted/70">
					💡 Clique em qualquer bloco para ver detalhes de gols, assistências e saldo
				</span>
			</div>

			{/* Área do Treemap */}
			{!hasData ? (
				<div className="py-14 text-center text-sm text-muted flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-xl bg-background/40">
					<Users className="w-10 h-10 text-muted/40 mb-1" />
					<p className="font-semibold text-main">Nenhuma parceria registrada para este filtro</p>
					<p className="text-xs text-muted max-w-sm">
						Este jogador ainda não atuou em partidas concluídas no período ou temporada selecionada.
					</p>
				</div>
			) : (
				<div className="relative w-full h-[420px] sm:h-[480px] rounded-xl overflow-hidden bg-background/50 border border-border p-1.5 select-none">
					{viewMode === 'pairs' ? (
						pairNodes.map(({ item, x, y, w, h }) => {
							const theme = getWinRateTheme(item.win_rate);
							const isCompact = w < 16 || h < 16;
							const isMicro = w < 10 || h < 10;

							return (
								<div
									key={item.partner_id}
									onClick={() => setSelectedPair(item)}
									style={{
										position: 'absolute',
										left: `${x}%`,
										top: `${y}%`,
										width: `${w}%`,
										height: `${h}%`,
										padding: '3px',
									}}
								>
									<div
										className={`w-full h-full rounded-lg bg-gradient-to-br ${theme.bg} border ${theme.border} p-2 sm:p-2.5 flex flex-col justify-between transition-all duration-150 cursor-pointer hover:scale-[0.99] hover:z-10 shadow-xs group`}
										title={`${item.partner_apelido}: ${item.matches_together} jogos juntos, ${item.win_rate}% vitórias`}
									>
										{/* Cabeçalho do Bloco */}
										<div className="min-w-0">
											<div className="flex items-center justify-between gap-1">
												<span
													className={`font-bold text-main truncate leading-tight ${
														isMicro
															? 'text-[10px]'
															: isCompact
																? 'text-xs'
																: 'text-xs sm:text-sm'
													}`}
												>
													{item.partner_apelido || item.partner_name}
												</span>
												{!isCompact && (
													<span
														className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${theme.badge}`}
													>
														{item.win_rate}% V
													</span>
												)}
											</div>

											{!isCompact && item.partner_posicao && (
												<span className="text-[10px] text-muted uppercase tracking-wider block mt-0.5 capitalize truncate">
													{item.partner_posicao}
												</span>
											)}
										</div>

										{/* Estatísticas resumidas do bloco */}
										{!isMicro && (
											<div className="mt-auto pt-1 flex items-end justify-between text-xs">
												<div>
													<span className="font-extrabold text-main text-sm sm:text-base leading-none block">
														{item.matches_together}
													</span>
													<span className="text-[10px] text-muted block leading-none mt-0.5">
														{item.matches_together === 1 ? 'jogo' : 'jogos'}
													</span>
												</div>

												{!isCompact && item.mutual_goals > 0 && (
													<span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
														⚽ {item.mutual_goals} em dupla
													</span>
												)}
											</div>
										)}
									</div>
								</div>
							);
						})
					) : (
						trioNodes.map(({ item, x, y, w, h }) => {
							const theme = getWinRateTheme(item.win_rate);
							const isCompact = w < 20 || h < 20;

							return (
								<div
									key={item.id}
									onClick={() => setSelectedTrio(item)}
									style={{
										position: 'absolute',
										left: `${x}%`,
										top: `${y}%`,
										width: `${w}%`,
										height: `${h}%`,
										padding: '3px',
									}}
								>
									<div
										className={`w-full h-full rounded-lg bg-gradient-to-br ${theme.bg} border ${theme.border} p-2.5 flex flex-col justify-between transition-all duration-150 cursor-pointer hover:scale-[0.99] hover:z-10 shadow-xs group`}
										title={`Trio com ${item.partner_1.apelido} & ${item.partner_2.apelido}: ${item.matches_together} jogos, ${item.win_rate}% vitórias`}
									>
										<div>
											<div className="flex items-center justify-between gap-1">
												<span className="font-bold text-main text-xs sm:text-sm truncate">
													{item.partner_1.apelido} + {item.partner_2.apelido}
												</span>
												<span
													className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${theme.badge}`}
												>
													{item.win_rate}% V
												</span>
											</div>
											<span className="text-[10px] text-muted block mt-0.5">
												Trio com {playerName || 'você'}
											</span>
										</div>

										<div className="mt-auto pt-1 flex items-end justify-between text-xs">
											<div>
												<span className="font-extrabold text-main text-sm sm:text-base leading-none block">
													{item.matches_together}
												</span>
												<span className="text-[10px] text-muted block leading-none mt-0.5">
													{item.matches_together === 1 ? 'jogo juntos' : 'jogos juntos'}
												</span>
											</div>

											{!isCompact && item.total_trio_goals > 0 && (
												<span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
													⚽ {item.total_trio_goals} gols do trio
												</span>
											)}
										</div>
									</div>
								</div>
							);
						})
					)}
				</div>
			)}

			{/* Legenda de Aproveitamento */}
			<div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border text-xs text-muted">
				<span className="font-medium text-main">Taxa de Vitórias:</span>
				<div className="flex items-center gap-3 sm:gap-4 flex-wrap">
					<div className="flex items-center gap-1.5">
						<span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
						<span>Excelente (≥60%)</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
						<span>Bom (45–59%)</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
						<span>Equilibrado (30–44%)</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
						<span>Desafio (&lt;30%)</span>
					</div>
				</div>
			</div>

			{/* MODAL DETALHE: DUPLA SELECIONADA */}
			<Modal
				isOpen={Boolean(selectedPair)}
				onClose={() => setSelectedPair(null)}
				title="Raio-X da Parceria (Dupla)"
				maxWidth="max-w-lg"
			>
				{selectedPair && (
					<div className="flex flex-col gap-5 text-sm">
						{/* Banner com a Dupla */}
						<div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
							<div className="flex items-center gap-3">
								<div className="w-12 h-12 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-lg">
									{selectedPair.partner_apelido.charAt(0).toUpperCase()}
								</div>
								<div>
									<h4 className="font-bold text-main text-base sm:text-lg leading-tight">
										{playerName || 'Jogador'} &amp; {selectedPair.partner_apelido}
									</h4>
									<p className="text-xs text-muted">
										{selectedPair.partner_name} • Pos: {selectedPair.partner_posicao}
									</p>
								</div>
							</div>

							<div className="text-right">
								<span className="text-xl sm:text-2xl font-black text-primary block leading-none">
									{selectedPair.win_rate}%
								</span>
								<span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
									Aproveitamento
								</span>
							</div>
						</div>

						{/* Grid de Métricas Principais */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
							<div className="p-3 rounded-xl bg-background border border-border text-center">
								<span className="text-xs text-muted block">Jogos Juntos</span>
								<span className="text-lg font-bold text-main mt-0.5 block">
									{selectedPair.matches_together}
								</span>
							</div>
							<div className="p-3 rounded-xl bg-background border border-border text-center">
								<span className="text-xs text-muted block">Vitórias</span>
								<span className="text-lg font-bold text-emerald-400 mt-0.5 block">
									{selectedPair.wins}
								</span>
							</div>
							<div className="p-3 rounded-xl bg-background border border-border text-center">
								<span className="text-xs text-muted block">Empates</span>
								<span className="text-lg font-bold text-amber-400 mt-0.5 block">
									{selectedPair.draws}
								</span>
							</div>
							<div className="p-3 rounded-xl bg-background border border-border text-center">
								<span className="text-xs text-muted block">Derrotas</span>
								<span className="text-lg font-bold text-rose-400 mt-0.5 block">
									{selectedPair.losses}
								</span>
							</div>
						</div>

						{/* Comparativo de Gols e Assistências dos Dois na Parceria */}
						<div className="bg-background border border-border rounded-xl p-4 flex flex-col gap-3">
							<span className="text-xs font-semibold text-main uppercase tracking-wider flex items-center gap-1.5">
								<Target className="w-3.5 h-3.5 text-primary" />
								Participação Ofensiva nos Jogos Juntos
							</span>

							<div className="grid grid-cols-2 gap-3 pt-1">
								<div className="p-3 rounded-lg bg-surface border border-border">
									<span className="text-xs font-bold text-main block truncate">
										{playerName || 'Você'}
									</span>
									<div className="flex items-center justify-between mt-2 text-xs">
										<span className="text-muted">Gols:</span>
										<span className="font-bold text-emerald-400">{selectedPair.player_goals}</span>
									</div>
									<div className="flex items-center justify-between mt-1 text-xs">
										<span className="text-muted">Assistências:</span>
										<span className="font-bold text-blue-400">{selectedPair.player_assists}</span>
									</div>
								</div>

								<div className="p-3 rounded-lg bg-surface border border-border">
									<span className="text-xs font-bold text-main block truncate">
										{selectedPair.partner_apelido}
									</span>
									<div className="flex items-center justify-between mt-2 text-xs">
										<span className="text-muted">Gols:</span>
										<span className="font-bold text-emerald-400">{selectedPair.partner_goals}</span>
									</div>
									<div className="flex items-center justify-between mt-1 text-xs">
										<span className="text-muted">Assistências:</span>
										<span className="font-bold text-blue-400">{selectedPair.partner_assists}</span>
									</div>
								</div>
							</div>

							{/* Sinergia Direta: Gol de um com passe do outro */}
							<div className="mt-1 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex flex-col gap-1.5 text-xs">
								<span className="font-bold text-emerald-400 flex items-center gap-1.5">
									<Sparkles className="w-3.5 h-3.5" />
									Sinergia Direta (Garçom &amp; Artilheiro)
								</span>
								<div className="flex items-center justify-between text-muted mt-0.5">
									<span>Gols de {playerName || 'Você'} c/ passe de {selectedPair.partner_apelido}:</span>
									<strong className="text-main">{selectedPair.player_assisted_by_partner}</strong>
								</div>
								<div className="flex items-center justify-between text-muted">
									<span>Gols de {selectedPair.partner_apelido} c/ passe de {playerName || 'Você'}:</span>
									<strong className="text-main">{selectedPair.partner_assisted_by_player}</strong>
								</div>
							</div>
						</div>

						{/* Saldo Coletivo */}
						<div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border text-xs">
							<span className="text-muted">Saldo coletivo da equipe nos jogos:</span>
							<span className="font-bold text-main">
								{selectedPair.goals_for} GP / {selectedPair.goals_against} GC ({selectedPair.goals_for - selectedPair.goals_against >= 0 ? '+' : ''}{selectedPair.goals_for - selectedPair.goals_against} SG)
							</span>
						</div>

						<Button type="button" onClick={() => setSelectedPair(null)} className="mt-1">
							Fechar Detalhes
						</Button>
					</div>
				)}
			</Modal>

			{/* MODAL DETALHE: TRIO SELECIONADO */}
			<Modal
				isOpen={Boolean(selectedTrio)}
				onClose={() => setSelectedTrio(null)}
				title="Raio-X da Química em Trio"
				maxWidth="max-w-lg"
			>
				{selectedTrio && (
					<div className="flex flex-col gap-5 text-sm">
						{/* Banner do Trio */}
						<div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex items-center justify-between">
							<div>
								<h4 className="font-bold text-main text-base sm:text-lg">
									{playerName || 'Jogador'} + {selectedTrio.partner_1.apelido} + {selectedTrio.partner_2.apelido}
								</h4>
								<p className="text-xs text-muted mt-0.5">
									Trio ofensivo/coletivo na mesma equipe
								</p>
							</div>

							<div className="text-right">
								<span className="text-xl sm:text-2xl font-black text-primary block leading-none">
									{selectedTrio.win_rate}%
								</span>
								<span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
									Vitórias
								</span>
							</div>
						</div>

						{/* Grid Resumo */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
							<div className="p-3 rounded-xl bg-background border border-border text-center">
								<span className="text-xs text-muted block">Jogos Juntos</span>
								<span className="text-lg font-bold text-main mt-0.5 block">
									{selectedTrio.matches_together}
								</span>
							</div>
							<div className="p-3 rounded-xl bg-background border border-border text-center">
								<span className="text-xs text-muted block">Vitórias</span>
								<span className="text-lg font-bold text-emerald-400 mt-0.5 block">
									{selectedTrio.wins}
								</span>
							</div>
							<div className="p-3 rounded-xl bg-background border border-border text-center">
								<span className="text-xs text-muted block">Empates</span>
								<span className="text-lg font-bold text-amber-400 mt-0.5 block">
									{selectedTrio.draws}
								</span>
							</div>
							<div className="p-3 rounded-xl bg-background border border-border text-center">
								<span className="text-xs text-muted block">Derrotas</span>
								<span className="text-lg font-bold text-rose-400 mt-0.5 block">
									{selectedTrio.losses}
								</span>
							</div>
						</div>

						{/* Participação dos 3 jogadores */}
						<div className="bg-background border border-border rounded-xl p-4 flex flex-col gap-3">
							<span className="text-xs font-semibold text-main uppercase tracking-wider">
								Gols e Assistências dos Integrantes do Trio
							</span>

							<div className="grid grid-cols-3 gap-2 text-center text-xs">
								<div className="p-2.5 rounded-lg bg-surface border border-border">
									<strong className="block text-main truncate">{playerName || 'Você'}</strong>
									<span className="text-emerald-400 font-bold block mt-1">{selectedTrio.player_goals} gols</span>
									<span className="text-blue-400 font-bold block">{selectedTrio.player_assists} ast</span>
								</div>

								<div className="p-2.5 rounded-lg bg-surface border border-border">
									<strong className="block text-main truncate">{selectedTrio.partner_1.apelido}</strong>
									<span className="text-emerald-400 font-bold block mt-1">{selectedTrio.partner_1_goals} gols</span>
									<span className="text-blue-400 font-bold block">{selectedTrio.partner_1_assists} ast</span>
								</div>

								<div className="p-2.5 rounded-lg bg-surface border border-border">
									<strong className="block text-main truncate">{selectedTrio.partner_2.apelido}</strong>
									<span className="text-emerald-400 font-bold block mt-1">{selectedTrio.partner_2_goals} gols</span>
									<span className="text-blue-400 font-bold block">{selectedTrio.partner_2_assists} ast</span>
								</div>
							</div>

							<div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
								<span className="text-muted">Total gerado pelos 3 nos jogos juntos:</span>
								<strong className="text-primary font-bold">
									{selectedTrio.total_trio_goals} Gols • {selectedTrio.total_trio_assists} Assistências
								</strong>
							</div>
						</div>

						<Button type="button" onClick={() => setSelectedTrio(null)} className="mt-1">
							Fechar Detalhes
						</Button>
					</div>
				)}
			</Modal>
		</div>
	);
}
