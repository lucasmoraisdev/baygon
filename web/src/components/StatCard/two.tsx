import { STAT_VARIANT } from '@/utils/helpers';

export function StatCard2({
	icon,
	value,
	label,
	sub,
	variant,
}: {
	icon: string;
	value: string | number;
	label: string;
	sub?: string;
	variant?: 'highlight' | 'gold' | 'green' | 'red';
}) {
	return (
		<div
			className={`border rounded-xl p-4 flex flex-col items-center text-center gap-1 ${STAT_VARIANT[variant ?? ''] ?? 'bg-surface border-border'}`}
		>
			<span className="text-2xl">{icon}</span>
			<span className="text-xl font-bold text-main">{value}</span>
			<span className="text-xs text-muted">{label}</span>
			{sub && <span className="text-xs text-muted/70">{sub}</span>}
		</div>
	);
}
