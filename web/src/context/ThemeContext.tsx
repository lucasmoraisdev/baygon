'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
	theme: Theme;
	toggleTheme: () => void;
	setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'baygon_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<Theme>('dark');
	const [mounted, setMounted] = useState<boolean>(false);

	useEffect(() => {
		try {
			const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
			if (saved === 'light' || saved === 'dark') {
				setThemeState(saved);
				applyTheme(saved);
			} else {
				applyTheme('dark');
			}
		} catch {
			applyTheme('dark');
		}
		setMounted(true);
	}, []);

	const applyTheme = (targetTheme: Theme) => {
		const root = document.documentElement;
		root.classList.remove('light', 'dark');
		root.classList.add(targetTheme);
		root.setAttribute('data-theme', targetTheme);
	};

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
		try {
			localStorage.setItem(THEME_STORAGE_KEY, newTheme);
		} catch {
			// Ignore localStorage issues
		}
		applyTheme(newTheme);
	};

	const toggleTheme = () => {
		const nextTheme = theme === 'dark' ? 'light' : 'dark';
		setTheme(nextTheme);
	};

	return (
		<ThemeContext.Provider
			value={{
				theme: mounted ? theme : 'dark',
				toggleTheme,
				setTheme,
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}
	return context;
}
