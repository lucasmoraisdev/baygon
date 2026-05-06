interface IProps {
	title: string;
	value: string | number;
}

export const StatsCard = ({ title, value }: IProps) => {
	return (
		<div className="bg-surface border border-border p-6 rounded-xl text-center cursor-default transition duration-200 hover:-translate-y-1 hover:border-border-hover hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
			<h3 className="text-base text-muted uppercase tracking-[0.5px] mb-2">
				{title}
			</h3>
			<div className="text-5xl text-primary font-bold">{value}</div>
		</div>
	);
};
