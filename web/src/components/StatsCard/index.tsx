import { ReactNode } from 'react';

interface StatsCardProps {
	title: string;
	value: string | number;
	subtitle?: string;
	icon?: ReactNode;
	accentColor?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose';
	footer?: ReactNode;
}

const ACCENT_STYLES: Record<
	NonNullable<StatsCardProps['accentColor']>,
	{ iconBg: string; borderHover: string; valueText: string }
> = {
	blue: {
		iconBg: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
		borderHover: 'hover:border-blue-500/40',
		valueText: 'text-main',
	},
	emerald: {
		iconBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
		borderHover: 'hover:border-emerald-500/40',
		valueText: 'text-main',
	},
	amber: {
		iconBg: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
		borderHover: 'hover:border-amber-500/40',
		valueText: 'text-main',
	},
	purple: {
		iconBg: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
		borderHover: 'hover:border-purple-500/40',
		valueText: 'text-main',
	},
	rose: {
		iconBg: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
		borderHover: 'hover:border-rose-500/40',
		valueText: 'text-main',
	},
};

export const StatsCard = ({
	title,
	value,
	subtitle,
	icon,
	accentColor = 'blue',
	footer,
}: StatsCardProps) => {
	const accent = ACCENT_STYLES[accentColor];

	return (
		<div
			className={`bg-surface border border-border rounded-xl p-4 flex flex-col justify-between gap-2.5 transition-all duration-200 ${accent.borderHover} hover:shadow-md`}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<span className="text-xs font-medium text-muted uppercase tracking-wider block truncate">
						{title}
					</span>
					<div
						className={`text-2xl font-bold mt-1 leading-tight ${accent.valueText}`}
					>
						{value}
					</div>
					{subtitle && (
						<p className="text-xs text-muted mt-0.5 truncate">
							{subtitle}
						</p>
					)}
				</div>
				{icon && (
					<div
						className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${accent.iconBg}`}
					>
						{icon}
					</div>
				)}
			</div>

			{footer && (
				<div className="pt-2.5 border-t border-border/60 text-xs text-muted">
					{footer}
				</div>
			)}
		</div>
	);
};
