import Providers from '@/components/Providers';
import './global.css';

export const metadata = {
	title: 'Baygon API - Admin Board',
	description: 'Sistema administrativo moderno do Baygon',
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="pt-BR" suppressHydrationWarning>
			<head>
				<script
					dangerouslySetInnerHTML={{
						__html: `
							try {
								const saved = localStorage.getItem('baygon_theme');
								const theme = (saved === 'light' || saved === 'dark') ? saved : 'dark';
								document.documentElement.classList.remove('light', 'dark');
								document.documentElement.classList.add(theme);
								document.documentElement.setAttribute('data-theme', theme);
							} catch (e) {}
						`,
					}}
				/>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin="anonymous"
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
					rel="stylesheet"
				/>
			</head>
			<body className="bg-background text-main min-h-screen transition-colors duration-200">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
