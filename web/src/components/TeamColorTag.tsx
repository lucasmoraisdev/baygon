'use client';

import { getTeamColor, TeamColorDefinition } from '@/lib/teamColors';
import React from 'react';

interface TeamColorTagProps {
	color?: string | null;
	fallbackIndex?: number;
	size?: 'sm' | 'md';
	showLabel?: boolean;
	className?: string;
}

export function TeamColorTag({
	color,
	fallbackIndex = 0,
	size = 'sm',
	showLabel = true,
	className = '',
}: TeamColorTagProps) {
	const teamColor: TeamColorDefinition = getTeamColor(color, fallbackIndex);

	const isSmall = size === 'sm';

	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full font-semibold border transition-colors shrink-0 ${teamColor.badgeBg
				} ${teamColor.badgeBorder} ${teamColor.badgeText} ${isSmall ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
				} ${className}`}
			title={`Colete ${teamColor.label}`}
		>
			<span
				className={`rounded-full shrink-0 ${isSmall ? 'w-2 h-2' : 'w-2.5 h-2.5'}`}
				style={{ backgroundColor: teamColor.hex }}
			/>
			{showLabel && <span>{teamColor.label}</span>}
		</span>
	);
}
