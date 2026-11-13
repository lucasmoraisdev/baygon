'use client';

import { useMemo, useState } from 'react';

export interface TimeSeriesPoint {
	id: string | number;
	label: string; // Short label for X axis (e.g. "R1", "10ª Temp")
	fullLabel: string; // Detailed label for tooltip (e.g. "Rodada #1 — 11ª Temporada")
	subLabel?: string; // Optional date or context (e.g. "14/03/2026")
	values: Record<string, number>;
}

export interface SeriesConfig {
	key: string;
	label: string;
	color: string;
	dashed?: boolean;
	fillArea?: boolean;
}

interface MultiSeriesTimeChartProps {
	title: string;
	subtitle?: string;
	points: TimeSeriesPoint[];
	series: SeriesConfig[];
	emptyMessage?: string;
	height?: number;
}

function buildSmoothSvgPath(coords: Array<{ x: number; y: number }>): string {
	if (coords.length === 0) return '';
	if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

	let d = `M ${coords[0].x} ${coords[0].y}`;
	for (let i = 0; i < coords.length - 1; i++) {
		const p0 = coords[i];
		const p1 = coords[i + 1];
		const cpx1 = p0.x + (p1.x - p0.x) * 0.45;
		const cpy1 = p0.y;
		const cpx2 = p0.x + (p1.x - p0.x) * 0.55;
		const cpy2 = p1.y;
		d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${p1.x} ${p1.y}`;
	}
	return d;
}

export function MultiSeriesTimeChart({
	title,
	subtitle,
	points,
	series,
	emptyMessage = 'Sem dados suficientes para exibir a série temporal.',
	height = 290,
}: MultiSeriesTimeChartProps) {
	const [mode, setMode] = useState<'period' | 'cumulative'>('period');
	const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
	const [hiddenKeys, setHiddenKeys] = useState<Record<string, boolean>>({});

	const activeSeries = useMemo(
		() => series.filter((s) => !hiddenKeys[s.key]),
		[series, hiddenKeys],
	);

	// Compute display points (either per-period or cumulative over time)
	const displayPoints = useMemo<TimeSeriesPoint[]>(() => {
		if (mode === 'period') return points;
		const running: Record<string, number> = {};
		for (const s of series) running[s.key] = 0;

		return points.map((pt) => {
			const nextValues: Record<string, number> = {};
			for (const s of series) {
				running[s.key] = (running[s.key] ?? 0) + (pt.values[s.key] ?? 0);
				nextValues[s.key] = running[s.key];
			}
			return {
				...pt,
				values: nextValues,
			};
		});
	}, [points, series, mode]);

	const totalsByKey = useMemo(() => {
		const res: Record<string, number> = {};
		for (const s of series) {
			res[s.key] = points.reduce(
				(acc, pt) => acc + (pt.values[s.key] ?? 0),
				0,
			);
		}
		return res;
	}, [points, series]);

	const maxValue = useMemo(() => {
		if (displayPoints.length === 0 || activeSeries.length === 0) return 4;
		let max = 0;
		for (const pt of displayPoints) {
			for (const s of activeSeries) {
				const v = pt.values[s.key] ?? 0;
				if (v > max) max = v;
			}
		}
		return Math.max(max, 4);
	}, [displayPoints, activeSeries]);

	const yTicks = useMemo(() => {
		const step = Math.max(1, Math.ceil(maxValue / 4));
		const top = step * 4;
		return [top, step * 3, step * 2, step, 0];
	}, [maxValue]);

	const yMax = yTicks[0] || 4;

	const svgWidth = 900;
	const svgHeight = height;
	const padLeft = 44;
	const padRight = 28;
	const padTop = 24;
	const padBottom = 42;
	const plotWidth = svgWidth - padLeft - padRight;
	const plotHeight = svgHeight - padTop - padBottom;

	const getX = (idx: number) => {
		if (displayPoints.length <= 1) return padLeft + plotWidth / 2;
		return padLeft + (idx / (displayPoints.length - 1)) * plotWidth;
	};

	const getY = (val: number) => {
		const ratio = Math.min(Math.max(val / yMax, 0), 1);
		return padTop + plotHeight - ratio * plotHeight;
	};

	const toggleSeries = (key: string) => {
		setHiddenKeys((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const hoveredPoint =
		hoveredIdx !== null && displayPoints[hoveredIdx]
			? displayPoints[hoveredIdx]
			: null;

	return (
		<div className="bg-surface border border-border rounded-xl p-5 sm:p-6 flex flex-col gap-4">
			{/* Top Header & Controls */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
				<div>
					<h2 className="text-base sm:text-lg font-semibold text-main">
						{title}
					</h2>
					{subtitle && (
						<p className="text-xs text-muted mt-0.5">{subtitle}</p>
					)}
				</div>

				<div className="flex flex-wrap items-center gap-3">
					{/* Legend Pills (Clickable to toggle) */}
					<div className="flex flex-wrap items-center gap-2">
						{series.map((s) => {
							const isHidden = Boolean(hiddenKeys[s.key]);
							return (
								<button
									key={s.key}
									type="button"
									onClick={() => toggleSeries(s.key)}
									className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
										isHidden
											? 'bg-background/30 border-border/50 text-muted/40 line-through'
											: 'bg-background/70 border-border text-main hover:border-border-hover'
									}`}
									title="Clique para mostrar/ocultar na série"
								>
									<span
										className="w-2.5 h-2.5 rounded-full shrink-0"
										style={{
											backgroundColor: s.color,
											opacity: isHidden ? 0.3 : 1,
										}}
									/>
									<span>{s.label}:</span>
									<strong
										className="font-bold"
										style={{
											color: isHidden
												? undefined
												: s.color,
										}}
									>
										{totalsByKey[s.key] ?? 0}
									</strong>
								</button>
							);
						})}
					</div>

					{/* Period vs Cumulative Toggle */}
					<div className="flex items-center bg-background/80 p-1 rounded-lg border border-border">
						<button
							type="button"
							onClick={() => setMode('period')}
							className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
								mode === 'period'
									? 'bg-primary text-white shadow-sm'
									: 'text-muted hover:text-main'
							}`}
						>
							Por Período
						</button>
						<button
							type="button"
							onClick={() => setMode('cumulative')}
							className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
								mode === 'cumulative'
									? 'bg-primary text-white shadow-sm'
									: 'text-muted hover:text-main'
							}`}
						>
							Acumulado
						</button>
					</div>
				</div>
			</div>

			{/* Main Chart Container */}
			{displayPoints.length === 0 ? (
				<div className="h-64 rounded-xl bg-background/40 border border-border/60 flex items-center justify-center text-sm text-muted">
					{emptyMessage}
				</div>
			) : (
				<div className="relative bg-background/50 border border-border/70 rounded-xl p-3 sm:p-4">
					{/* Floating Tooltip Header Bar */}
					<div className="flex items-center justify-between gap-2 mb-2 min-h-[28px] px-2 py-1 rounded-lg bg-surface/70 border border-border/50 text-xs">
						{hoveredPoint ? (
							<>
								<div className="flex items-center gap-2 font-semibold text-main">
									<span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
									<span>{hoveredPoint.fullLabel}</span>
									{hoveredPoint.subLabel && (
										<span className="text-muted font-normal">
											({hoveredPoint.subLabel})
										</span>
									)}
								</div>
								<div className="flex items-center gap-3 flex-wrap">
									{activeSeries.map((s) => (
										<span
											key={s.key}
											className="flex items-center gap-1"
										>
											<span
												className="w-2 h-2 rounded-full"
												style={{
													backgroundColor: s.color,
												}}
											/>
											<span className="text-muted">
												{s.label}:
											</span>
											<strong
												className="font-bold"
												style={{ color: s.color }}
											>
												{hoveredPoint.values[s.key] ??
													0}
											</strong>
										</span>
									))}
								</div>
							</>
						) : (
							<span className="text-muted">
								Passe o mouse sobre os pontos do gráfico para
								inspecionar os detalhes de cada período.
							</span>
						)}
					</div>

					{/* Responsive SVG */}
					<div className="w-full overflow-x-auto">
						<svg
							viewBox={`0 0 ${svgWidth} ${svgHeight}`}
							className="w-full h-auto min-w-[560px] select-none overflow-visible"
						>
							<defs>
								{series.map((s) => (
									<linearGradient
										key={`grad-${s.key}`}
										id={`grad-${title.replace(/\s+/g, '-')}-${s.key}`}
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="0%"
											stopColor={s.color}
											stopOpacity="0.28"
										/>
										<stop
											offset="100%"
											stopColor={s.color}
											stopOpacity="0.0"
										/>
									</linearGradient>
								))}
							</defs>

							{/* Horizontal Grid Lines & Y-Axis Labels */}
							{yTicks.map((tick, i) => {
								const y = getY(tick);
								return (
									<g key={i}>
										<line
											x1={padLeft}
											y1={y}
											x2={svgWidth - padRight}
											y2={y}
											stroke="rgba(255,255,255,0.07)"
											strokeDasharray={
												tick === 0 ? undefined : '4 4'
											}
										/>
										<text
											x={padLeft - 10}
											y={y + 4}
											textAnchor="end"
											className="fill-slate-400 text-[11px] font-medium"
										>
											{tick}
										</text>
									</g>
								);
							})}

							{/* Hover Vertical Guide Line */}
							{hoveredIdx !== null &&
								displayPoints[hoveredIdx] && (
									<line
										x1={getX(hoveredIdx)}
										y1={padTop}
										x2={getX(hoveredIdx)}
										y2={padTop + plotHeight}
										stroke="rgba(59,130,246,0.45)"
										strokeWidth="1.5"
										strokeDasharray="3 3"
									/>
								)}

							{/* Area Fills & Lines per Series */}
							{activeSeries.map((s) => {
								const coords = displayPoints.map((pt, idx) => ({
									x: getX(idx),
									y: getY(pt.values[s.key] ?? 0),
									val: pt.values[s.key] ?? 0,
								}));

								const linePath = buildSmoothSvgPath(coords);
								const areaPath =
									coords.length > 1
										? `${linePath} L ${coords[coords.length - 1].x} ${padTop + plotHeight} L ${coords[0].x} ${padTop + plotHeight} Z`
										: '';

								return (
									<g key={s.key}>
										{s.fillArea !== false &&
											coords.length > 1 && (
												<path
													d={areaPath}
													fill={`url(#grad-${title.replace(/\s+/g, '-')}-${s.key})`}
												/>
											)}

										<path
											d={linePath}
											fill="none"
											stroke={s.color}
											strokeWidth={s.dashed ? 2 : 2.75}
											strokeDasharray={
												s.dashed ? '6 4' : undefined
											}
											strokeLinecap="round"
											strokeLinejoin="round"
										/>

										{/* Data Points */}
										{coords.map((c, idx) => {
											const isHovered =
												hoveredIdx === idx;
											return (
												<g key={idx}>
													<circle
														cx={c.x}
														cy={c.y}
														r={isHovered ? 6 : 4}
														fill="#0f172a"
														stroke={s.color}
														strokeWidth={
															isHovered ? 3 : 2.2
														}
														className="transition-all duration-150"
													/>
													{/* Value label above point when few points or hovered */}
													{(isHovered ||
														displayPoints.length <=
															12) &&
														c.val > 0 && (
															<text
																x={c.x}
																y={c.y - 10}
																textAnchor="middle"
																fill={s.color}
																className="text-[10px] font-bold pointer-events-none"
															>
																{c.val}
															</text>
														)}
												</g>
											);
										})}
									</g>
								);
							})}

							{/* X-Axis Labels & Interactive Hover Columns */}
							{displayPoints.map((pt, idx) => {
								const x = getX(idx);
								const colWidth =
									displayPoints.length > 1
										? plotWidth / (displayPoints.length - 1)
										: plotWidth;
								const showLabel =
									displayPoints.length <= 16 ||
									idx === 0 ||
									idx === displayPoints.length - 1 ||
									idx %
										Math.ceil(displayPoints.length / 12) ===
										0;

								return (
									<g key={pt.id}>
										{showLabel && (
											<text
												x={x}
												y={padTop + plotHeight + 22}
												textAnchor="middle"
												className={`text-[11px] transition-colors ${
													hoveredIdx === idx
														? 'fill-white font-bold'
														: 'fill-slate-400 font-medium'
												}`}
											>
												{pt.label}
											</text>
										)}
										{showLabel && pt.subLabel && (
											<text
												x={x}
												y={padTop + plotHeight + 35}
												textAnchor="middle"
												className="fill-slate-500 text-[9px]"
											>
												{pt.subLabel}
											</text>
										)}
										{/* Invisible hover hit area */}
										<rect
											x={x - colWidth / 2}
											y={padTop}
											width={colWidth}
											height={plotHeight + padBottom}
											fill="transparent"
											className="cursor-pointer"
											onMouseEnter={() =>
												setHoveredIdx(idx)
											}
											onMouseLeave={() =>
												setHoveredIdx(null)
											}
										/>
									</g>
								);
							})}
						</svg>
					</div>
				</div>
			)}
		</div>
	);
}
