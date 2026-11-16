'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface SidebarContextType {
	isCollapsed: boolean;
	toggleSidebar: () => void;
	setIsCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
	isMobileOpen: boolean;
	toggleMobileSidebar: () => void;
	setIsMobileOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const STORAGE_KEY = 'baygon_sidebar_collapsed';

export function SidebarProvider({ children }: { children: React.ReactNode }) {
	const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
	const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
	const [mounted, setMounted] = useState<boolean>(false);

	useEffect(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved !== null) {
				setIsCollapsed(saved === 'true');
			}
		} catch {
			// Ignore localStorage errors (e.g. private browsing)
		}
		setMounted(true);
	}, []);

	const toggleSidebar = () => {
		setIsCollapsed((prev) => {
			const next = !prev;
			try {
				localStorage.setItem(STORAGE_KEY, String(next));
			} catch {
				// Ignore
			}
			return next;
		});
	};

	const toggleMobileSidebar = () => {
		setIsMobileOpen((prev) => !prev);
	};

	return (
		<SidebarContext.Provider
			value={{
				isCollapsed: mounted ? isCollapsed : false,
				toggleSidebar,
				setIsCollapsed,
				isMobileOpen,
				toggleMobileSidebar,
				setIsMobileOpen,
			}}
		>
			{children}
		</SidebarContext.Provider>
	);
}

export function useSidebar() {
	const context = useContext(SidebarContext);
	if (!context) {
		throw new Error('useSidebar must be used within a SidebarProvider');
	}
	return context;
}
