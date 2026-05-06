import { LoaderCircle } from 'lucide-react';

interface IProps {
	className?: string;
}

export const Loading = ({ className = '' }: IProps) => {
	return <LoaderCircle className={className} />;
};
