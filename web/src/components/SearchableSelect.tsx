'use client';

import React, {
	useState,
	useRef,
	useEffect,
	useMemo,
	useCallback,
} from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface SelectOption {
	value: string | number;
	label: string;
	sublabel?: string;
	badge?: string;
	badgeVariant?: 'default' | 'success' | 'warning' | 'info';
	group?: string;
	disabled?: boolean;
	disabledReason?: string;
	icon?: React.ReactNode;
}

export interface SearchableSelectProps {
	label?: string;
	placeholder?: string;
	searchPlaceholder?: string;
	options: SelectOption[];
	value: string | number;
	onChange: (value: string) => void;
	isLoading?: boolean;
	disabled?: boolean;
	className?: string;
	triggerClassName?: string;
	emptyMessage?: string;
	allOptionLabel?: string;
	showAllOption?: boolean;
}

export function SearchableSelect({
	label,
	placeholder = 'Selecione uma opção',
	searchPlaceholder = 'Buscar...',
	options = [],
	value,
	onChange,
	isLoading = false,
	disabled = false,
	className = '',
	triggerClassName = '',
	emptyMessage = 'Nenhum resultado encontrado',
	allOptionLabel,
	showAllOption = false,
}: SearchableSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [activeDescendantIndex, setActiveDescendantIndex] = useState(0);

	const containerRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const optionsListRef = useRef<HTMLDivElement>(null);

	// Opção atualmente selecionada
	const selectedOption = useMemo(() => {
		const strValue = value?.toString() ?? '';
		if (!strValue && showAllOption) return null;
		return options.find((opt) => opt.value.toString() === strValue) || null;
	}, [options, value, showAllOption]);

	// Lista de opções completas incluindo "Todas" se habilitado
	const allOptionsWithDefault = useMemo(() => {
		const list: SelectOption[] = [];
		if (showAllOption) {
			list.push({
				value: '',
				label: allOptionLabel || 'Todos',
			});
		}
		return [...list, ...options];
	}, [options, showAllOption, allOptionLabel]);

	// Opções filtradas pela busca
	const filteredOptions = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return allOptionsWithDefault;

		return allOptionsWithDefault.filter((opt) => {
			const labelMatch = opt.label.toLowerCase().includes(q);
			const sublabelMatch = opt.sublabel?.toLowerCase().includes(q);
			const badgeMatch = opt.badge?.toLowerCase().includes(q);
			return labelMatch || sublabelMatch || badgeMatch;
		});
	}, [allOptionsWithDefault, searchQuery]);

	// Agrupamento por 'group' se houver
	const groupedSections = useMemo(() => {
		const hasAnyGroup = filteredOptions.some((opt) => !!opt.group);

		if (!hasAnyGroup) {
			return [{ title: '', options: filteredOptions }];
		}

		const map: { [key: string]: SelectOption[] } = {};
		for (const opt of filteredOptions) {
			const g = opt.group || 'Outros';
			if (!map[g]) map[g] = [];
			map[g].push(opt);
		}

		return Object.keys(map).map((title) => ({
			title,
			options: map[title],
		}));
	}, [filteredOptions]);

	// Lista achatada de opções navegáveis
	const flatVisibleOptions = useMemo(() => {
		const list: SelectOption[] = [];
		for (const section of groupedSections) {
			for (const opt of section.options) {
				list.push(opt);
			}
		}
		return list;
	}, [groupedSections]);

	// Abre o dropdown
	const openDropdown = () => {
		if (disabled || isLoading) return;
		setIsOpen(true);
		setSearchQuery('');
		setActiveDescendantIndex(0);
	};

	// Fecha o dropdown
	const closeDropdown = () => {
		setIsOpen(false);
		triggerRef.current?.focus();
	};

	// Foco no input ao abrir
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

	// Seleciona um valor
	const handleSelect = useCallback(
		(opt: SelectOption) => {
			if (opt.disabled) return;
			onChange(opt.value.toString());
			closeDropdown();
		},
		[onChange],
	);

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
				prev < flatVisibleOptions.length - 1 ? prev + 1 : 0,
			);
			return;
		}

		if (e.key === 'ArrowUp') {
			e.preventDefault();
			setActiveDescendantIndex((prev) =>
				prev > 0 ? prev - 1 : flatVisibleOptions.length - 1,
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
			setActiveDescendantIndex(flatVisibleOptions.length - 1);
			return;
		}

		if (e.key === 'Enter') {
			e.preventDefault();
			const selected = flatVisibleOptions[activeDescendantIndex];
			if (selected && !selected.disabled) {
				handleSelect(selected);
			}
		}
	};

	// Renderiza badge com estilo semântico
	const renderBadge = (
		badge: string,
		variant: SelectOption['badgeVariant'] = 'default',
	) => {
		if (variant === 'success') {
			return (
				<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
					<span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
					{badge}
				</span>
			);
		}
		if (variant === 'warning') {
			return (
				<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
					{badge}
				</span>
			);
		}
		return (
			<span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-surface text-muted border border-border">
				{badge}
			</span>
		);
	};

	return (
		<div
			ref={containerRef}
			className={`relative inline-block w-full ${className}`}
			onKeyDown={handleKeyDown}
		>
			{/* Gatilho (Botão fechado) - min-height 44px */}
			<button
				ref={triggerRef}
				type="button"
				onClick={() => (isOpen ? closeDropdown() : openDropdown())}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				disabled={disabled || isLoading}
				className={`w-full min-h-[44px] px-3.5 py-1.5 flex items-center justify-between gap-2.5 bg-background border border-border rounded-xl hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-left group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
					isOpen ? 'border-primary ring-2 ring-primary/10 shadow-sm' : ''
				} ${triggerClassName}`}
			>
				<div className="flex flex-col justify-center min-w-0 flex-1">
					{label && (
						<span className="text-[10px] sm:text-[11px] font-semibold text-muted uppercase tracking-wider leading-none truncate">
							{label}
						</span>
					)}
					<div className="flex items-center gap-2 mt-0.5 min-w-0">
						{selectedOption?.icon && (
							<span className="shrink-0">
								{selectedOption.icon}
							</span>
						)}
						<span
							className={`text-sm font-medium truncate ${
								selectedOption || (showAllOption && !value)
									? 'text-main font-semibold'
									: 'text-muted'
							}`}
						>
							{selectedOption
								? selectedOption.label
								: showAllOption && !value
									? allOptionLabel || 'Todos'
									: placeholder}
						</span>
						{selectedOption?.badge && (
							<div className="shrink-0">
								{renderBadge(
									selectedOption.badge,
									selectedOption.badgeVariant,
								)}
							</div>
						)}
					</div>
				</div>

				<ChevronDown
					className={`w-4 h-4 text-muted transition-transform duration-200 motion-reduce:transition-none group-hover:text-main shrink-0 ${
						isOpen ? 'rotate-180 text-primary' : ''
					}`}
				/>
			</button>

			{/* Anúncio leitor de tela */}
			<div className="sr-only" aria-live="polite">
				{isOpen
					? `${filteredOptions.length} opções disponíveis.`
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
				<div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface p-4 flex flex-col max-h-[70vh] shadow-2xl animate-in slide-in-from-bottom duration-200 sm:absolute sm:inset-auto sm:left-0 sm:top-full sm:mt-1.5 sm:w-full sm:min-w-[260px] sm:rounded-xl sm:border sm:border-border sm:p-2 sm:max-h-[340px] sm:slide-in-from-top-1 motion-reduce:transition-none motion-reduce:animate-none">
					{/* Puxador de Bottom Sheet (Mobile) */}
					<div className="w-12 h-1 bg-muted/30 rounded-full mx-auto mb-3 sm:hidden" />

					{/* Header do painel (Mobile) */}
					<div className="flex items-center justify-between pb-2 mb-2 sm:hidden border-b border-border/60">
						<span className="text-sm font-bold text-main">
							{label ? `Selecionar ${label}` : 'Selecionar Opção'}
						</span>
						<button
							type="button"
							onClick={closeDropdown}
							className="p-1 text-muted hover:text-main rounded-lg"
						>
							<X className="w-5 h-5" />
						</button>
					</div>

					{/* Campo de busca */}
					<div className="relative mb-2">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
						<input
							ref={searchInputRef}
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder={searchPlaceholder}
							className="w-full bg-background border border-border rounded-lg pl-9 pr-8 py-2 text-sm text-main placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={() => setSearchQuery('')}
								className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main p-0.5 rounded cursor-pointer"
							>
								<X className="w-3.5 h-3.5" />
							</button>
						)}
					</div>

					{/* Lista de Opções */}
					<div
						ref={optionsListRef}
						role="listbox"
						aria-label={label || 'Opções'}
						className="flex-1 overflow-y-auto space-y-2 sm:space-y-1.5 pr-1 select-none"
					>
						{filteredOptions.length === 0 ? (
							<div className="py-6 text-center text-sm text-muted">
								{emptyMessage}
							</div>
						) : (
							groupedSections.map((section, secIdx) => (
								<div key={secIdx} className="space-y-0.5">
									{section.title && (
										<div className="text-[11px] font-bold text-muted uppercase tracking-wider px-2 py-1">
											{section.title}
										</div>
									)}

									{section.options.map((opt) => {
										const isSelected =
											value?.toString() ===
											opt.value?.toString();
										const itemFlatIndex =
											flatVisibleOptions.findIndex(
												(o) => o.value === opt.value,
											);
										const isHighlighted =
											itemFlatIndex ===
											activeDescendantIndex;

										return (
											<div
												key={opt.value}
												role="option"
												aria-selected={isSelected}
												aria-disabled={opt.disabled}
												onClick={() =>
													!opt.disabled &&
													handleSelect(opt)
												}
												onMouseEnter={() =>
													setActiveDescendantIndex(
														itemFlatIndex,
													)
												}
												className={`flex items-center justify-between px-3 py-2.5 sm:py-2 rounded-lg text-sm transition-colors cursor-pointer ${
													opt.disabled
														? 'opacity-50 cursor-not-allowed bg-transparent'
														: isSelected
															? 'bg-primary/10 text-primary font-semibold'
															: isHighlighted
																? 'bg-nav-hover text-main'
																: 'text-main hover:bg-nav-hover'
												}`}
											>
												<div className="flex items-center gap-2 min-w-0 flex-1">
													{opt.icon && (
														<span className="shrink-0">
															{opt.icon}
														</span>
													)}
													<div className="flex flex-col min-w-0">
														<span className="truncate">
															{opt.label}
														</span>
														{opt.sublabel && (
															<span className="text-xs text-muted truncate">
																{opt.sublabel}
															</span>
														)}
													</div>
													{opt.badge && (
														<div className="shrink-0 ml-1">
															{renderBadge(
																opt.badge,
																opt.badgeVariant,
															)}
														</div>
													)}
													{opt.disabled &&
														opt.disabledReason && (
															<span className="text-[10px] text-muted italic ml-1 truncate">
																({opt.disabledReason})
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
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}
