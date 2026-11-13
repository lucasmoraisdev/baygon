import { COLOR_MAP } from '@/utils/helpers';
import { ReactNode } from 'react';

export function StatCard({
	label,
	value,
	subLabel,
	icon,
	color = 'gray',
}: {
	label: string;
	value: number | string;
	subLabel?: string;
	icon?: ReactNode;
	color?: string;
}) {
	return (
		<div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between gap-2.5 hover:border-border-hover hover:shadow-md transition-all">
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs font-semibold uppercase tracking-wider text-muted truncate">
					{label}
				</span>
				{icon && (
					<div className="w-8 h-8 rounded-lg bg-background/70 border border-border flex items-center justify-center shrink-0">
						{icon}
					</div>
				)}
			</div>
			<div className="flex items-baseline justify-between gap-2">
				<span
					className={`text-2xl sm:text-3xl font-bold leading-none ${COLOR_MAP[color] ?? 'text-main'}`}
				>
					{value}
				</span>
				{subLabel && (
					<span className="text-xs font-medium text-muted bg-white/5 px-2 py-0.5 rounded-md truncate">
						{subLabel}
					</span>
				)}
			</div>
		</div>
	);
}
