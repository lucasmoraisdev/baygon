import { COLOR_MAP } from '@/utils/helpers';

export function StatCard({
	label,
	value,
	color = 'gray',
}: {
	label: string;
	value: number;
	color?: string;
}) {
	return (
		<div className="bg-surface border border-border rounded-xl p-3 flex flex-col gap-1 items-center text-center">
			<span className="text-xs text-muted">{label}</span>
			<span
				className={`text-2xl font-bold ${COLOR_MAP[color] ?? 'text-main'}`}
			>
				{value}
			</span>
		</div>
	);
}
