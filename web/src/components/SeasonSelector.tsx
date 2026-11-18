'use client';

import React, {
	useState,
	useRef,
	useEffect,
	useMemo,
	useCallback,
} from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronDown, Search, Check, X, Calendar, Sparkles } from 'lucide-react';

export interface Season {
	id_season: number;
	number: number;
	initial_date?: string;
	end_date?: string | null;
	is_active?: boolean;
	has_data?: boolean;
}

export interface SeasonSelectorProps {
	seasons: Season[];
	selectedSeasonId?: number | string;
	onSelectSeason: (season: Season) => void;
	isLoading?: boolean;
	className?: string;
	hasDataFn?: (season: Season) => boolean;
}

// Formata o período de anos da temporada a partir das datas
function getSeasonYearPeriod(season: Season): string | null {
	if (!season.initial_date) {
		// Se number parecer um ano (ex: 2024)
		if (season.number >= 1990 && season.number <= 2100) {
			return `${season.number}`;
		}
		return null;
	}

	try {
		const startYear = new Date(season.initial_date).getFullYear();
		if (isNaN(startYear)) return null;

		if (season.end_date) {
			const endYear = new Date(season.end_date).getFullYear();
			if (!isNaN(endYear) && endYear !== startYear) {
				return `${startYear}/${String(endYear).slice(-2)}`;
			}
		}
		return `${startYear}`;
	} catch {
		return null;
	}
}

// Retorna o rótulo principal legível
function getSeasonDisplayName(season: Season): string {
	const period = getSeasonYearPeriod(season);
	if (season.number >= 1990 && season.number <= 2100) {
		return `Temporada ${season.number}`;
	}
	return `${season.number}ª Temporada${period ? ` (${period})` : ''}`;
}

// Retorna o rótulo compacto para o gatilho do botão
function getSeasonTriggerLabel(season: Season): string {
	if (season.number >= 1990 && season.number <= 2100) {
		return `Temporada ${season.number}`;
	}
	return `${season.number}ª Temporada`;
}

// Retorna o slug/identificador para a URL
function getSeasonSlug(season: Season): string {
	const period = getSeasonYearPeriod(season);
	if (period && period.includes('/')) {
		return period.replace('/', '-');
	}
	return season.number.toString();
}

// Extrai o ano ou década para agrupamento
function getDecadeForSeason(season: Season): string {
	let year: number | null = null;
	if (season.initial_date) {
		const d = new Date(season.initial_date).getFullYear();
		if (!isNaN(d) && d > 1900) year = d;
	}
	if (!year && season.number >= 1990 && season.number <= 2100) {
		year = season.number;
	}

	if (year) {
		const startDecade = Math.floor(year / 10) * 10;
		return `${startDecade} a ${startDecade + 9}`;
	}

	// Caso sejam números sequenciais puros sem ano
	const startBlock = Math.floor(season.number / 10) * 10;
	return `Edições ${startBlock} a ${startBlock + 9}`;
}

export function SeasonSelector({
	seasons,
	selectedSeasonId,
	onSelectSeason,
	isLoading = false,
	className = '',
	hasDataFn,
}: SeasonSelectorProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [activeDescendantIndex, setActiveDescendantIndex] = useState(0);

	const containerRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const optionsListRef = useRef<HTMLDivElement>(null);

	// Ordena temporadas da mais recente para a mais antiga
	const sortedSeasons = useMemo(() => {
		return [...seasons].sort((a, b) => {
			if (b.number !== a.number) return b.number - a.number;
			return (
				new Date(b.initial_date || 0).getTime() -
				new Date(a.initial_date || 0).getTime()
			);
		});
	}, [seasons]);

	// Temporada atualmente selecionada
	const currentSeason = useMemo(() => {
		if (selectedSeasonId !== undefined && selectedSeasonId !== '') {
			const found = sortedSeasons.find(
				(s) =>
					s.id_season.toString() === selectedSeasonId.toString() ||
					s.number.toString() === selectedSeasonId.toString(),
			);
			if (found) return found;
		}
		// Fallback: temporada ativa ou a mais recente
		return sortedSeasons.find((s) => s.is_active) || sortedSeasons[0] || null;
	}, [sortedSeasons, selectedSeasonId]);

	// Sincronização inicial com a URL (?temporada=...)
	useEffect(() => {
		if (!sortedSeasons.length) return;

		const param = searchParams.get('temporada');
		if (param) {
			const cleanParam = param.trim().toLowerCase();
			const matched = sortedSeasons.find((s) => {
				const slug = getSeasonSlug(s).toLowerCase();
				const num = s.number.toString();
				const id = s.id_season.toString();
				const period = getSeasonYearPeriod(s)?.toLowerCase();
				return (
					slug === cleanParam ||
					num === cleanParam ||
					id === cleanParam ||
					period === cleanParam
				);
			});

			if (matched && matched.id_season !== currentSeason?.id_season) {
				onSelectSeason(matched);
			}
		}
	}, [searchParams, sortedSeasons, currentSeason?.id_season, onSelectSeason]);

	// Atualiza URL ao trocar de temporada
	const handleSelect = useCallback(
		(season: Season) => {
			if (hasDataFn && !hasDataFn(season) && season.has_data === false) {
				return;
			}
			onSelectSeason(season);
			setIsOpen(false);
			triggerRef.current?.focus();

			// Atualiza a URL mantendo outros query params
			const nextParams = new URLSearchParams(searchParams.toString());
			const slug = getSeasonSlug(season);
			nextParams.set('temporada', slug);
			router.replace(`${pathname}?${nextParams.toString()}`, {
				scroll: false,
			});
		},
		[
			hasDataFn,
			onSelectSeason,
			searchParams,
			router,
			pathname,
		],
	);

	// Filtra temporadas pela busca
	const filteredSeasons = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return sortedSeasons;

		return sortedSeasons.filter((s) => {
			const num = s.number.toString();
			const period = getSeasonYearPeriod(s)?.toLowerCase() || '';
			const display = getSeasonDisplayName(s).toLowerCase();
			const slug = getSeasonSlug(s).toLowerCase();

			return (
				num.includes(q) ||
				period.includes(q) ||
				display.includes(q) ||
				slug.includes(q) ||
				q.includes(num)
			);
		});
	}, [sortedSeasons, searchQuery]);

	// Agrupamento: Recentes (Top 3) e Décadas
	const groupedSections = useMemo(() => {
		if (!filteredSeasons.length) return [];

		// Se há busca ativa, agrupa direto por década/faixa
		if (searchQuery.trim()) {
			const groups: { [key: string]: Season[] } = {};
			for (const season of filteredSeasons) {
				const decade = getDecadeForSeason(season);
				if (!groups[decade]) groups[decade] = [];
				groups[decade].push(season);
			}

			return Object.keys(groups).map((title) => ({
				title,
				seasons: groups[title],
			}));
		}

		// Sem busca: Top 3 como "Recentes" e o restante por década
		const recent = sortedSeasons.slice(0, 3);
		const older = sortedSeasons.slice(3);

		const sections: { title: string; seasons: Season[] }[] = [];

		if (recent.length > 0) {
			sections.push({
				title: 'Recentes',
				seasons: recent,
			});
		}

		if (older.length > 0) {
			const decadeGroups: { [key: string]: Season[] } = {};
			for (const season of older) {
				const decade = getDecadeForSeason(season);
				if (!decadeGroups[decade]) decadeGroups[decade] = [];
				decadeGroups[decade].push(season);
			}

			for (const title of Object.keys(decadeGroups)) {
				sections.push({
					title,
					seasons: decadeGroups[title],
				});
			}
		}

		return sections;
	}, [filteredSeasons, searchQuery, sortedSeasons]);

	// Lista linear achatada de temporadas visíveis para navegação por teclado
	const flatVisibleSeasons = useMemo(() => {
		const list: Season[] = [];
		for (const section of groupedSections) {
			for (const s of section.seasons) {
				list.push(s);
			}
		}
		return list;
	}, [groupedSections]);

	// Abre o dropdown
	const openDropdown = () => {
		setIsOpen(true);
		setSearchQuery('');
		setActiveDescendantIndex(0);
	};

	// Fecha o dropdown
	const closeDropdown = () => {
		setIsOpen(false);
		triggerRef.current?.focus();
	};

	// Foco automático no input ao abrir
	useEffect(() => {
		if (isOpen) {
			setTimeout(() => {
				searchInputRef.current?.focus();
			}, 50);
		}
	}, [isOpen]);

	// Fecha ao clicar fora
	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		}

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen]);

	// Navegação por teclado
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!isOpen) {
			if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
				e.preventDefault();
				openDropdown();
			}
			return;
		}

		if (e.key === 'Escape') {
			e.preventDefault();
			closeDropdown();
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setActiveDescendantIndex((prev) =>
				prev < flatVisibleSeasons.length - 1 ? prev + 1 : 0,
			);
			return;
		}

		if (e.key === 'ArrowUp') {
			e.preventDefault();
			setActiveDescendantIndex((prev) =>
				prev > 0 ? prev - 1 : flatVisibleSeasons.length - 1,
			);
			return;
		}

		if (e.key === 'Home') {
			e.preventDefault();
			setActiveDescendantIndex(0);
			return;
		}

		if (e.key === 'End') {
			e.preventDefault();
			setActiveDescendantIndex(flatVisibleSeasons.length - 1);
			return;
		}

		if (e.key === 'Enter') {
			e.preventDefault();
			const selected = flatVisibleSeasons[activeDescendantIndex];
			if (selected) {
				handleSelect(selected);
			}
		}
	};

	// Verifica se a temporada está em andamento
	const isCurrentOngoing = Boolean(
		currentSeason?.is_active ||
			(currentSeason && !currentSeason.end_date),
	);

	return (
		<div
			ref={containerRef}
			className={`relative ${className}`}
			onKeyDown={handleKeyDown}
		>
			{/* Gatilho (Botão fechado) - min-height 44px */}
			<button
				ref={triggerRef}
				type="button"
				onClick={() => (isOpen ? closeDropdown() : openDropdown())}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-controls="season-dropdown-panel"
				className={`w-full min-h-[44px] px-3.5 py-1.5 flex items-center justify-between gap-2.5 bg-surface border border-border rounded-xl hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-left group cursor-pointer ${
					isOpen ? 'border-primary ring-2 ring-primary/10 shadow-sm' : ''
				}`}
				disabled={isLoading}
			>
				<div className="flex flex-col justify-center min-w-0 flex-1">
					<span className="text-[10px] sm:text-[11px] font-semibold text-muted uppercase tracking-wider leading-none">
						Temporada
					</span>
					<div className="flex items-center gap-2 mt-0.5 min-w-0">
						<span className="text-xs sm:text-sm font-semibold text-main whitespace-nowrap truncate">
							{currentSeason
								? getSeasonTriggerLabel(currentSeason)
								: 'Selecione'}
						</span>
						{isCurrentOngoing && (
							<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap shrink-0">
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
								Em andamento
							</span>
						)}
					</div>
				</div>

				<ChevronDown
					className={`w-4 h-4 text-muted transition-transform duration-200 motion-reduce:transition-none group-hover:text-main shrink-0 ml-1.5 ${
						isOpen ? 'rotate-180 text-primary' : ''
					}`}
				/>
			</button>

			{/* Anúncio leitor de tela */}
			<div className="sr-only" aria-live="polite">
				{isOpen
					? `${filteredSeasons.length} temporadas encontradas.`
					: ''}
			</div>

			{/* Mobile Backdrop */}
			{isOpen && (
				<div
					className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs sm:hidden"
					onClick={closeDropdown}
					aria-hidden="true"
				/>
			)}

			{/* Painel Dropdown: Bottom Sheet no mobile, Popover ancorado no desktop */}
			{isOpen && (
				<div
					id="season-dropdown-panel"
					className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface p-4 flex flex-col max-h-[70vh] shadow-2xl animate-in slide-in-from-bottom duration-200 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[320px] sm:rounded-xl sm:border sm:border-border sm:p-2 sm:max-h-[380px] sm:slide-in-from-top-1 motion-reduce:transition-none motion-reduce:animate-none"
				>
					{/* Puxador de Bottom Sheet (Mobile) */}
					<div className="w-12 h-1 bg-muted/30 rounded-full mx-auto mb-3 sm:hidden" />

					{/* Header do painel (Mobile) */}
					<div className="flex items-center justify-between pb-2 mb-2 sm:hidden border-b border-border/60">
						<span className="text-sm font-bold text-main">
							Selecionar Temporada
						</span>
						<button
							type="button"
							onClick={closeDropdown}
							className="p-1 text-muted hover:text-main rounded-lg"
						>
							<X className="w-5 h-5" />
						</button>
					</div>

					{/* 1. Campo de busca */}
					<div className="relative mb-2">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
						<input
							ref={searchInputRef}
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Buscar temporada (ex: 12, 2024)..."
							className="w-full bg-background border border-border rounded-lg pl-9 pr-8 py-2 text-sm text-main placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={() => setSearchQuery('')}
								className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main p-0.5 rounded"
							>
								<X className="w-3.5 h-3.5" />
							</button>
						)}
					</div>

					{/* Lista de Opções agrupadas */}
					<div
						ref={optionsListRef}
						role="listbox"
						aria-label="Lista de temporadas"
						className="flex-1 overflow-y-auto space-y-3 sm:space-y-2 pr-1 select-none"
					>
						{groupedSections.length === 0 ? (
							<div className="py-6 text-center text-sm text-muted">
								Nenhuma temporada encontrada
							</div>
						) : (
							groupedSections.map((section) => (
								<div key={section.title} className="space-y-1">
									{/* Rótulo do Grupo */}
									<div className="text-[11px] font-bold text-muted uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
										{section.title === 'Recentes' && (
											<Sparkles className="w-3 h-3 text-amber-500" />
										)}
										<span>{section.title}</span>
									</div>

									{/* Itens do Grupo */}
									<div className="space-y-0.5">
										{section.seasons.map((season) => {
											const isSelected =
												currentSeason?.id_season ===
												season.id_season;
											const period =
												getSeasonYearPeriod(season);
											const hasData = hasDataFn
												? hasDataFn(season)
												: season.has_data !== false;
											const isOngoing = Boolean(
												season.is_active ||
													!season.end_date,
											);

											// Índice linear para destaque de teclado
											const itemFlatIndex =
												flatVisibleSeasons.findIndex(
													(s) =>
														s.id_season ===
														season.id_season,
												);
											const isHighlighted =
												itemFlatIndex ===
												activeDescendantIndex;

											return (
												<div
													key={season.id_season}
													role="option"
													aria-selected={isSelected}
													aria-disabled={!hasData}
													onClick={() =>
														hasData &&
														handleSelect(season)
													}
													onMouseEnter={() =>
														setActiveDescendantIndex(
															itemFlatIndex,
														)
													}
													className={`flex items-center justify-between px-3 py-2.5 sm:py-2 rounded-lg text-sm transition-colors cursor-pointer ${
														!hasData
															? 'opacity-50 cursor-not-allowed bg-transparent'
															: isSelected
																? 'bg-primary/10 text-primary font-semibold'
																: isHighlighted
																	? 'bg-nav-hover text-main'
																	: 'text-main hover:bg-nav-hover'
													}`}
												>
													<div className="flex items-center gap-2 min-w-0">
														<span className="truncate">
															Temporada{' '}
															{season.number}
														</span>
														{period && (
															<span className="text-xs text-muted truncate">
																({period})
															</span>
														)}
														{isOngoing && (
															<span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-500">
																Atual
															</span>
														)}
														{!hasData && (
															<span className="text-[10px] text-muted italic ml-1">
																Sem dados
															</span>
														)}
													</div>

													{isSelected && (
														<Check className="w-4 h-4 text-primary shrink-0 ml-2" />
													)}
												</div>
											);
										})}
									</div>
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}
