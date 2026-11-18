import fs from 'fs';

// Workaround para projetos em pastas do OneDrive no Windows:
// O OneDrive cria reparse points que fazem o Dirent.isSymbolicLink() retornar true
// e o fs.promises.readlink() lançar EINVAL durante o recursiveDelete do Next.js.
const origReadlink = fs.promises.readlink.bind(fs.promises);
fs.promises.readlink = async (p, options) => {
	try {
		return await origReadlink(p, options);
	} catch (err) {
		if (err && (err.code === 'EINVAL' || err.code === 'UNKNOWN')) {
			return p;
		}
		throw err;
	}
};

const origUnlink = fs.promises.unlink.bind(fs.promises);
fs.promises.unlink = async (p) => {
	try {
		return await origUnlink(p);
	} catch (err) {
		if (err && (err.code === 'EPERM' || err.code === 'EISDIR')) {
			return await fs.promises.rmdir(p);
		}
		throw err;
	}
};

/** @type {import('next').NextConfig} */
const nextConfig = {
	webpack: (config, { dev }) => {
		if (dev) {
			config.cache = false;
		}
		return config;
	},
};

export default nextConfig;
