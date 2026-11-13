import { ReactNode } from 'react';

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	maxWidth?: string;
}

export function Modal({
	isOpen,
	onClose,
	title,
	children,
	maxWidth = 'max-w-sm',
}: ModalProps) {
	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4 z-[1000] overflow-y-auto"
			onClick={onClose}
		>
			<div
				className={`bg-[#111a2e] border border-white/[0.08] rounded-2xl p-7 w-full ${maxWidth} shadow-[0_20px_50px_rgba(0,0,0,0.65)] text-[#e6edf7] animate-slide-down my-auto`}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between mb-5">
					<h2 className="text-[22px] font-bold text-[#e6edf7] m-0">
						{title}
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Fechar"
						className="text-[#94a3b8] hover:text-white text-xl leading-none p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
					>
						✕
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}
