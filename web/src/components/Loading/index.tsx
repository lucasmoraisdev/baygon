import { LoaderCircle } from 'lucide-react';

interface IProps {
	className?: string;
}

export const Loading = ({ className = '' }: IProps) => {
	return (
		<div className="flex items-center justify-center h-screen">
			<LoaderCircle className={`animate-spin ${className}`} />
		</div>
	);
};
