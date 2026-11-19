'use client';

import React, { useState } from 'react';
import { RoundMedia } from '@/types/types';
import {
	Film,
	ExternalLink,
	Trash2,
	Plus,
	Play,
	Video,
	AlertCircle,
	CheckCircle2,
	Sparkles,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';

interface RoundMediaSectionProps {
	roundId: number;
	roundNumber?: number;
	mediaList: RoundMedia[];
	isLoading?: boolean;
	isAdmin?: boolean;
	onAddMedia?: (payload: {
		url: string;
		title?: string;
		media_type?: string;
	}) => Promise<void>;
	onDeleteMedia?: (mediaId: number) => Promise<void>;
}

export function extractYouTubeId(url: string): string | null {
	try {
		const clean = url.trim();
		// Formatos: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/shorts/ID, youtube.com/embed/ID
		const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
		const match = clean.match(regExp);
		return match ? match[1] : null;
	} catch {
		return null;
	}
}

export function extractInstagramCode(url: string): string | null {
	try {
		const clean = url.trim();
		const regExp = /instagram\.com\/(?:p|reel|tv)\/([^/?#&]+)/;
		const match = clean.match(regExp);
		return match ? match[1] : null;
	} catch {
		return null;
	}
}

export function extractTikTokId(url: string): string | null {
	try {
		const clean = url.trim();
		const regExp = /tiktok\.com\/.*\/video\/(\d+)/;
		const match = clean.match(regExp);
		return match ? match[1] : null;
	} catch {
		return null;
	}
}

export function detectMediaType(url: string): 'youtube' | 'instagram' | 'tiktok' | 'other' {
	const lower = url.toLowerCase();
	if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
	if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'instagram';
	if (lower.includes('tiktok.com')) return 'tiktok';
	return 'other';
}

function YouTubeIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
		</svg>
	);
}

function InstagramIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
		</svg>
	);
}

function TikTokIcon({ className = 'w-4 h-4' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor">
			<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.24 1.2 2.23 2.44 2.47.74.15 1.51.04 2.19-.28.84-.39 1.46-1.14 1.67-2.04.14-.62.15-1.28.15-1.92V.02z" />
		</svg>
	);
}

export function RoundMediaSection({
	roundId,
	roundNumber,
	mediaList,
	isLoading = false,
	isAdmin = false,
	onAddMedia,
	onDeleteMedia,
}: RoundMediaSectionProps) {
	const [url, setUrl] = useState('');
	const [title, setTitle] = useState('');
	const [selectedType, setSelectedType] = useState('auto');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!url.trim() || !onAddMedia) return;

		setIsSubmitting(true);
		setFeedbackMsg(null);
		try {
			const typeToSend = selectedType === 'auto' ? undefined : selectedType;
			await onAddMedia({
				url: url.trim(),
				title: title.trim() || undefined,
				media_type: typeToSend,
			});
			setUrl('');
			setTitle('');
			setSelectedType('auto');
			setFeedbackMsg({ type: 'success', text: 'Mídia adicionada com sucesso!' });
			setTimeout(() => setFeedbackMsg(null), 3000);
		} catch (err: any) {
			setFeedbackMsg({
				type: 'error',
				text: err?.message || 'Erro ao adicionar mídia. Verifique o link.',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (mediaId: number) => {
		if (!onDeleteMedia) return;
		if (!confirm('Deseja realmente remover esta mídia da rodada?')) return;

		setDeletingId(mediaId);
		try {
			await onDeleteMedia(mediaId);
		} catch (err: any) {
			alert(`Erro ao remover mídia: ${err?.message || 'Falha na requisição'}`);
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<div className="flex flex-col gap-6">
			{/* Cabeçalho da Seção */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-border rounded-xl p-4 sm:px-5">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
						<Film className="w-5 h-5" />
					</div>
					<div>
						<div className="flex items-center gap-2">
							<h3 className="text-base sm:text-lg font-bold text-main">
								Mídias & Vídeos da Rodada
							</h3>
							{roundNumber && (
								<span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
									{roundNumber}ª Rodada
								</span>
							)}
						</div>
						<p className="text-xs text-muted mt-0.5">
							Assista aos melhores momentos no YouTube, reels do Instagram e vídeos do TikTok.
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 text-xs font-medium text-muted">
					<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border">
						<Video className="w-3.5 h-3.5 text-primary" />
						<strong className="text-main">{mediaList.length}</strong>{' '}
						{mediaList.length === 1 ? 'mídia vinculada' : 'mídias vinculadas'}
					</span>
				</div>
			</div>

			{/* Formulário de Cadastro (Apenas Admin) */}
			{isAdmin && onAddMedia && (
				<div className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
					<div className="flex items-center gap-2">
						<div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
							<Plus className="w-3.5 h-3.5" />
						</div>
						<h4 className="text-sm font-bold text-main">Cadastrar Nova Mídia Social</h4>
					</div>

					<form onSubmit={handleAdd} className="flex flex-col gap-3">
						<div className="grid grid-cols-1 md:grid-cols-12 gap-3">
							<div className="md:col-span-6">
								<label className="block text-xs font-semibold text-muted mb-1.5">
									URL do Vídeo / Post <span className="text-red-500">*</span>
								</label>
								<Input
									placeholder="Cole o link do YouTube, Instagram ou TikTok..."
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									required
								/>
							</div>
							<div className="md:col-span-4">
								<label className="block text-xs font-semibold text-muted mb-1.5">
									Título / Legenda (Opcional)
								</label>
								<Input
									placeholder="Ex: Melhores momentos, Golaço..."
									value={title}
									onChange={(e) => setTitle(e.target.value)}
								/>
							</div>
							<div className="md:col-span-2">
								<label className="block text-xs font-semibold text-muted mb-1.5">
									Plataforma
								</label>
								<Select
									value={selectedType}
									onChange={(e) => setSelectedType(e.target.value)}
								>
									<option value="auto">Automático</option>
									<option value="youtube">YouTube</option>
									<option value="instagram">Instagram</option>
									<option value="tiktok">TikTok</option>
									<option value="other">Outro</option>
								</Select>
							</div>
						</div>

						<div className="flex items-center justify-between flex-wrap gap-2 pt-1">
							<div className="flex items-center gap-3 text-xs text-muted">
								<span className="flex items-center gap-1 text-red-600 dark:text-red-400">
									<YouTubeIcon className="w-3.5 h-3.5" /> YouTube
								</span>
								<span className="flex items-center gap-1 text-pink-600 dark:text-pink-400">
									<InstagramIcon className="w-3.5 h-3.5" /> Instagram
								</span>
								<span className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200">
									<TikTokIcon className="w-3.5 h-3.5" /> TikTok
								</span>
							</div>

							<Button
								type="submit"
								disabled={isSubmitting || !url.trim()}
								className="!w-auto flex items-center gap-1.5 text-xs px-4"
							>
								<Plus className="w-3.5 h-3.5" />
								<span>{isSubmitting ? 'Salvando...' : 'Adicionar à Rodada'}</span>
							</Button>
						</div>

						{feedbackMsg && (
							<div
								className={`flex items-center gap-2 p-3 rounded-lg text-xs font-medium ${
									feedbackMsg.type === 'success'
										? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
										: 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30'
								}`}
							>
								{feedbackMsg.type === 'success' ? (
									<CheckCircle2 className="w-4 h-4 shrink-0" />
								) : (
									<AlertCircle className="w-4 h-4 shrink-0" />
								)}
								<span>{feedbackMsg.text}</span>
							</div>
						)}
					</form>
				</div>
			)}

			{/* Lista / Galeria de Mídias */}
			{isLoading ? (
				<div className="py-12 flex justify-center text-muted text-sm">
					Carregando mídias da rodada...
				</div>
			) : mediaList.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-8 text-center flex flex-col items-center justify-center gap-2 text-muted">
					<Film className="w-8 h-8 opacity-40 mb-1" />
					<p className="text-sm font-medium text-main">Nenhuma mídia vinculada a esta rodada ainda.</p>
					<p className="text-xs">
						{isAdmin
							? 'Utilize o formulário acima para cadastrar vídeos do YouTube, reels ou TikTok.'
							: 'Fique atento! Em breve a comissão do baba publicará os vídeos e fotos desta rodada.'}
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
					{mediaList.map((media) => {
						const detected = detectMediaType(media.url);
						const finalType = media.media_type || detected;
						const ytId = extractYouTubeId(media.url);
						const instaCode = extractInstagramCode(media.url);
						const tiktokId = extractTikTokId(media.url);

						return (
							<div
								key={media.id_round_media}
								className="bg-surface border border-border hover:border-primary/40 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
							>
								{/* Top Header do Card */}
								<div className="p-3.5 flex items-center justify-between gap-2 border-b border-border bg-background/50">
									<div className="flex items-center gap-2 min-w-0">
										{finalType === 'youtube' && (
											<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
												<YouTubeIcon className="w-3.5 h-3.5" />
												YouTube
											</span>
										)}
										{finalType === 'instagram' && (
											<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30">
												<InstagramIcon className="w-3.5 h-3.5" />
												Instagram
											</span>
										)}
										{finalType === 'tiktok' && (
											<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-zinc-500/15 text-main border border-zinc-500/30">
												<TikTokIcon className="w-3.5 h-3.5" />
												TikTok
											</span>
										)}
										{finalType === 'other' && (
											<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-500/15 text-primary border border-primary/30">
												<Video className="w-3.5 h-3.5" />
												Vídeo
											</span>
										)}

										<h4 className="text-xs sm:text-sm font-bold text-main truncate" title={media.title || media.url}>
											{media.title || 'Mídia da Rodada'}
										</h4>
									</div>

									<div className="flex items-center gap-1 shrink-0">
										<a
											href={media.url}
											target="_blank"
											rel="noopener noreferrer"
											title="Abrir no app / link original"
											className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-nav-hover transition-colors"
										>
											<ExternalLink className="w-3.5 h-3.5" />
										</a>

										{isAdmin && onDeleteMedia && (
											<button
												type="button"
												disabled={deletingId === media.id_round_media}
												onClick={() => handleDelete(media.id_round_media)}
												title="Excluir mídia"
												className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-colors cursor-pointer"
											>
												<Trash2 className="w-3.5 h-3.5" />
											</button>
										)}
									</div>
								</div>

								{/* Player ou Visualizador embutido na plataforma */}
								<div className="bg-black flex items-center justify-center relative overflow-hidden">
									{/* YouTube: Player embutido completo */}
									{finalType === 'youtube' && ytId ? (
										<div className="w-full aspect-video">
											<iframe
												src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`}
												title={media.title || 'Vídeo do YouTube'}
												className="w-full h-full border-0"
												allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
												allowFullScreen
											/>
										</div>
									) : finalType === 'instagram' && instaCode ? (
										/* Instagram: Embed ou preview com atalho interativo */
										<div className="w-full py-4 px-2 flex flex-col items-center justify-center text-center bg-gradient-to-br from-purple-900/40 via-background to-pink-900/30 min-h-[220px]">
											<div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white mb-3 shadow-lg">
												<InstagramIcon className="w-7 h-7" />
											</div>
											<p className="text-xs font-semibold text-main mb-1">
												Publicação / Reel no Instagram
											</p>
											<p className="text-[11px] text-muted max-w-xs mb-3 truncate">
												{media.title || media.url}
											</p>
											<a
												href={media.url}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-semibold shadow-sm transition-all"
											>
												<span>Assistir no Instagram</span>
												<ExternalLink className="w-3.5 h-3.5" />
											</a>
										</div>
									) : finalType === 'tiktok' ? (
										/* TikTok: Preview estilizado com atalho direto */
										<div className="w-full py-4 px-2 flex flex-col items-center justify-center text-center bg-gradient-to-br from-zinc-900 via-background to-cyan-950/40 min-h-[220px]">
											<div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-cyan-400 mb-3 shadow-lg">
												<TikTokIcon className="w-7 h-7" />
											</div>
											<p className="text-xs font-semibold text-main mb-1">
												Vídeo no TikTok
											</p>
											<p className="text-[11px] text-muted max-w-xs mb-3 truncate">
												{media.title || media.url}
											</p>
											<a
												href={media.url}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 text-xs font-semibold shadow-sm transition-all"
											>
												<span>Assistir no TikTok</span>
												<ExternalLink className="w-3.5 h-3.5" />
											</a>
										</div>
									) : (
										/* Outros links de vídeo */
										<div className="w-full py-6 px-4 flex flex-col items-center justify-center text-center bg-surface min-h-[200px]">
											<div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2">
												<Play className="w-6 h-6" />
											</div>
											<p className="text-xs font-semibold text-main mb-2">
												{media.title || 'Mídia da Rodada'}
											</p>
											<a
												href={media.url}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors"
											>
												<span>Abrir Link da Mídia</span>
												<ExternalLink className="w-3 h-3" />
											</a>
										</div>
									)}
								</div>

								{/* Rodapé do Card */}
								<div className="p-3 bg-surface text-[11px] text-muted flex items-center justify-between border-t border-border">
									<span className="truncate max-w-[240px]" title={media.url}>
										{media.url}
									</span>
									{media.created_at && (
										<span>
											{new Date(media.created_at).toLocaleDateString('pt-BR', {
												day: '2-digit',
												month: '2-digit',
											})}
										</span>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
