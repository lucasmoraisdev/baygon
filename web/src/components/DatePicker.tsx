'use client';

import {
	Calendar as CalendarIcon,
	ChevronLeft,
	ChevronRight,
	X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface DatePickerProps {
	value: string; // Format: YYYY-MM-DD
	onChange: (e: { target: { value: string } }) => void;
	required?: boolean;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

const MONTHS_PT = [
	'Janeiro',
	'Fevereiro',
	'Março',
	'Abril',
	'Maio',
	'Junho',
	'Julho',
	'Agosto',
	'Setembro',
	'Outubro',
	'Novembro',
	'Dezembro',
];

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function parseIsoDate(val: string): { y: number; m: number; d: number } | null {
	if (!val) return null;
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(val);
	if (!match) return null;
	const y = parseInt(match[1], 10);
	const m = parseInt(match[2], 10);
	const d = parseInt(match[3], 10);
	if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1000 || y > 9999) return null;
	return { y, m, d };
}

function formatIsoToBr(val: string): string {
	const parsed = parseIsoDate(val);
	if (!parsed) return '';
	const dd = String(parsed.d).padStart(2, '0');
	const mm = String(parsed.m).padStart(2, '0');
	const yyyy = String(parsed.y).slice(0, 4);
	return `${dd}/${mm}/${yyyy}`;
}

function formatMaskBr(rawDigits: string): string {
	const digits = rawDigits.replace(/\D/g, '').slice(0, 8); // DD (2) + MM (2) + YYYY (4) = max 8 digits
	if (digits.length <= 2) return digits;
	if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
	return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

export function DatePicker({
	value,
	onChange,
	required = false,
	placeholder = 'DD/MM/AAAA',
	disabled = false,
	className = '',
}: DatePickerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [inputText, setInputText] = useState(() => formatIsoToBr(value));

	const today = useMemo(() => new Date(), []);
	const parsedValue = useMemo(() => parseIsoDate(value), [value]);

	const [viewYear, setViewYear] = useState<number>(
		() => parsedValue?.y ?? today.getFullYear(),
	);
	const [viewMonth, setViewMonth] = useState<number>(
		() => (parsedValue ? parsedValue.m - 1 : today.getMonth()),
	);
	const [yearInput, setYearInput] = useState<string>(() =>
		String(parsedValue?.y ?? today.getFullYear()),
	);

	useEffect(() => {
		setInputText(formatIsoToBr(value));
		const parsed = parseIsoDate(value);
		if (parsed) {
			setViewYear(parsed.y);
			setViewMonth(parsed.m - 1);
			setYearInput(String(parsed.y));
		}
	}, [value]);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};
		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [isOpen]);

	const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const masked = formatMaskBr(e.target.value);
		setInputText(masked);

		if (masked === '') {
			onChange({ target: { value: '' } });
			return;
		}

		// When all 8 digits are typed (DD/MM/YYYY with 4-digit year)
		if (masked.length === 10) {
			const [ddStr, mmStr, yyyyStr] = masked.split('/');
			const d = parseInt(ddStr, 10);
			const m = parseInt(mmStr, 10);
			const y = parseInt(yyyyStr.slice(0, 4), 10);

			if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 9999) {
				const maxDays = new Date(y, m, 0).getDate();
				const safeDay = Math.min(d, maxDays);
				const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
				onChange({ target: { value: iso } });
				setViewYear(y);
				setViewMonth(m - 1);
				setYearInput(String(y));
			}
		}
	};

	const handleSelectDay = (day: number) => {
		const safeYear = Math.min(Math.max(viewYear, 1900), 9999);
		const iso = `${String(safeYear).padStart(4, '0')}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		onChange({ target: { value: iso } });
		setInputText(formatIsoToBr(iso));
		setIsOpen(false);
	};

	const handlePrevMonth = () => {
		if (viewMonth === 0) {
			const nextY = Math.max(1900, viewYear - 1);
			setViewMonth(11);
			setViewYear(nextY);
			setYearInput(String(nextY));
		} else {
			setViewMonth(viewMonth - 1);
		}
	};

	const handleNextMonth = () => {
		if (viewMonth === 11) {
			const nextY = Math.min(9999, viewYear + 1);
			setViewMonth(0);
			setViewYear(nextY);
			setYearInput(String(nextY));
		} else {
			setViewMonth(viewMonth + 1);
		}
	};

	const handleYearInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
		setYearInput(digits);
		if (digits.length === 4) {
			const y = parseInt(digits, 10);
			if (y >= 1900 && y <= 9999) {
				setViewYear(y);
			}
		}
	};

	const handleYearBlur = () => {
		const y = parseInt(yearInput, 10);
		if (!isNaN(y) && y >= 1900 && y <= 9999) {
			setViewYear(y);
			setYearInput(String(y));
		} else {
			setYearInput(String(viewYear));
		}
	};

	const calendarDays = useMemo(() => {
		const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

		const cells: Array<{
			day: number;
			currentMonth: boolean;
			dateObj: { y: number; m: number; d: number };
		}> = [];

		// Leading days from previous month
		for (let i = firstDayOfWeek - 1; i >= 0; i--) {
			const d = daysInPrevMonth - i;
			const m = viewMonth === 0 ? 12 : viewMonth;
			const y = viewMonth === 0 ? viewYear - 1 : viewYear;
			cells.push({ day: d, currentMonth: false, dateObj: { y, m, d } });
		}

		// Current month days
		for (let d = 1; d <= daysInMonth; d++) {
			cells.push({
				day: d,
				currentMonth: true,
				dateObj: { y: viewYear, m: viewMonth + 1, d },
			});
		}

		// Trailing days
		const remaining = (7 - (cells.length % 7)) % 7;
		for (let d = 1; d <= remaining; d++) {
			const m = viewMonth === 11 ? 1 : viewMonth + 2;
			const y = viewMonth === 11 ? viewYear + 1 : viewYear;
			cells.push({ day: d, currentMonth: false, dateObj: { y, m, d } });
		}

		return cells;
	}, [viewYear, viewMonth]);

	const handleToday = () => {
		const y = today.getFullYear();
		const m = today.getMonth() + 1;
		const d = today.getDate();
		const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		onChange({ target: { value: iso } });
		setInputText(formatIsoToBr(iso));
		setViewYear(y);
		setViewMonth(m - 1);
		setYearInput(String(y));
		setIsOpen(false);
	};

	const handleClear = () => {
		onChange({ target: { value: '' } });
		setInputText('');
		setIsOpen(false);
	};

	return (
		<div ref={containerRef} className={`relative w-full ${className}`}>
			<div className="relative flex items-center">
				<input
					type="text"
					inputMode="numeric"
					maxLength={10}
					value={inputText}
					onChange={handleTextChange}
					onFocus={() => !disabled && setIsOpen(true)}
					placeholder={placeholder}
					required={required}
					disabled={disabled}
					className="w-full pl-3 pr-10 py-2 bg-background/90 border border-border rounded-lg text-main text-sm placeholder:text-muted/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
				/>
				<div className="absolute right-1.5 flex items-center gap-0.5">
					{inputText && !disabled && !required && (
						<button
							type="button"
							onClick={handleClear}
							className="p-1 text-muted hover:text-main rounded-md hover:bg-white/5 transition-colors"
							title="Limpar data"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					)}
					<button
						type="button"
						disabled={disabled}
						onClick={() => setIsOpen((prev) => !prev)}
						className={`p-1.5 rounded-md transition-colors ${
							isOpen
								? 'bg-primary/20 text-primary'
								: 'text-primary/80 hover:text-primary hover:bg-primary/10'
						}`}
						title="Abrir calendário"
					>
						<CalendarIcon className="w-4 h-4" />
					</button>
				</div>
			</div>

			{isOpen && (
				<div className="absolute left-0 top-full mt-2 z-[1100] w-72 bg-[#0f172a] border border-white/15 rounded-xl p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.65)] animate-slide-down select-none">
					{/* Calendar Header */}
					<div className="flex items-center justify-between gap-1.5 mb-3 pb-2.5 border-b border-border">
						<button
							type="button"
							onClick={handlePrevMonth}
							className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-white/5 border border-transparent hover:border-border transition-colors"
							title="Mês anterior"
						>
							<ChevronLeft className="w-4 h-4" />
						</button>

						<div className="flex items-center gap-1.5 flex-1 justify-center">
							<select
								value={viewMonth}
								onChange={(e) => setViewMonth(Number(e.target.value))}
								className="bg-surface border border-border rounded-md px-2 py-1 text-xs font-semibold text-main focus:outline-none focus:border-primary cursor-pointer"
							>
								{MONTHS_PT.map((m, idx) => (
									<option key={m} value={idx} className="bg-[#0f172a] text-main">
										{m}
									</option>
								))}
							</select>

							<input
								type="text"
								inputMode="numeric"
								maxLength={4}
								value={yearInput}
								onChange={handleYearInputChange}
								onBlur={handleYearBlur}
								aria-label="Ano (4 dígitos)"
								className="w-14 bg-surface border border-border rounded-md px-1.5 py-1 text-xs font-semibold text-main text-center focus:outline-none focus:border-primary"
							/>
						</div>

						<button
							type="button"
							onClick={handleNextMonth}
							className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-white/5 border border-transparent hover:border-border transition-colors"
							title="Próximo mês"
						>
							<ChevronRight className="w-4 h-4" />
						</button>
					</div>

					{/* Weekdays */}
					<div className="grid grid-cols-7 gap-1 mb-1.5">
						{WEEKDAYS_PT.map((w) => (
							<div
								key={w}
								className="text-[10px] font-semibold uppercase tracking-wider text-muted text-center py-1"
							>
								{w}
							</div>
						))}
					</div>

					{/* Days Grid */}
					<div className="grid grid-cols-7 gap-1">
						{calendarDays.map((cell, idx) => {
							const isSelected =
								parsedValue &&
								parsedValue.y === cell.dateObj.y &&
								parsedValue.m === cell.dateObj.m &&
								parsedValue.d === cell.dateObj.d;

							const isToday =
								today.getFullYear() === cell.dateObj.y &&
								today.getMonth() + 1 === cell.dateObj.m &&
								today.getDate() === cell.dateObj.d;

							return (
								<button
									key={idx}
									type="button"
									onClick={() => {
										if (!cell.currentMonth) {
											setViewYear(cell.dateObj.y);
											setViewMonth(cell.dateObj.m - 1);
											setYearInput(String(cell.dateObj.y));
										}
										const iso = `${String(cell.dateObj.y).padStart(4, '0')}-${String(cell.dateObj.m).padStart(2, '0')}-${String(cell.dateObj.d).padStart(2, '0')}`;
										onChange({ target: { value: iso } });
										setInputText(formatIsoToBr(iso));
										setIsOpen(false);
									}}
									className={`h-8 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
										isSelected
											? 'bg-primary text-white font-bold shadow-md shadow-primary/30'
											: isToday
												? 'border border-primary/60 text-primary bg-primary/10 font-semibold'
												: cell.currentMonth
													? 'text-main hover:bg-white/10'
													: 'text-muted/35 hover:text-muted hover:bg-white/5'
									}`}
								>
									{cell.day}
								</button>
							);
						})}
					</div>

					{/* Footer */}
					<div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-border text-xs">
						<button
							type="button"
							onClick={handleClear}
							className="px-2 py-1 rounded-md text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
						>
							Limpar
						</button>
						<button
							type="button"
							onClick={handleToday}
							className="px-2.5 py-1 rounded-md font-medium text-primary hover:bg-primary/15 transition-colors"
						>
							Hoje
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
