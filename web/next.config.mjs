// next.config.mjs limpo sem monkeypatching de fs (que causava loop recursivo no @vercel/nft)

/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		optimizePackageImports: ['lucide-react', '@tanstack/react-table'],
	},
	productionBrowserSourceMaps: false,
	webpack: (config, { dev }) => {
		if (dev) {
			config.cache = false;
		}
		return config;
	},
};

export default nextConfig;
