'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import {
	CostStatus,
	FeeStatus,
	FinancialCost,
	FinancialSummary,
	MonthlyFee,
} from '@/types/financial';
import { Player } from '@/types/types';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import {
	AlertCircle,
	ArrowDownRight,
	ArrowUpRight,
	Calendar,
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	Coins,
	Copy,
	CreditCard,
	DollarSign,
	Download,
	Filter,
	Pencil,
	Plus,
	Receipt,
	RefreshCw,
	Search,
	ShieldAlert,
	Sparkles,
	Trash2,
	TrendingDown,
	TrendingUp,
	Users,
	Wallet,
	X,
} from 'lucide-react';
import Link from 'next/link';
import React, { useMemo, useState } from 'react';

const MONTH_NAMES = [
	'Janeiro',
	'Fevereiro',
	'Março',
	'Abril',
	'Maio',
	'Junho',
	'Julho',
	'Agosto',
	'Setembro',
	'Outubro',
	'Novembro',
	'Dezembro',
];

const COST_CATEGORIES = [
	'Campo/Quadra',
	'Arbitragem',
	'Material Esportivo',
	'Confraternização',
	'Premiações',
	'Taxas/Serviços',
	'Outros',
];

const PAYMENT_METHODS = [
	'PIX',
	'Dinheiro',
	'Transferência',
	'Cartão',
	'Boleto',
	'Outro',
];

function formatCurrency(val: number | string | undefined | null): string {
	const num = Number(val) || 0;
	return new Intl.NumberFormat('pt-BR', {
		style: 'currency',
		currency: 'BRL',
	}).format(num);
}

function formatDate(dateStr?: string | null): string {
	if (!dateStr) return '—';
	try {
		const d = new Date(dateStr);
		return d.toLocaleDateString('pt-BR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		});
	} catch {
		return dateStr;
	}
}

export default function FinancialPage() {
	const { user, loading: authLoading } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');
	const queryClient = useQueryClient();

	const now = new Date();
	const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
	const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

	const [activeTab, setActiveTab] = useState<'fees' | 'costs' | 'flow'>('fees');

	// Filtros da aba de mensalidades
	const [feeStatusFilter, setFeeStatusFilter] = useState<'all' | 'paid' | 'pending' | 'exempt'>('all');
	const [feeSearch, setFeeSearch] = useState('');
	const [selectedFeeIds, setSelectedFeeIds] = useState<number[]>([]);

	// Filtros da aba de custos
	const [costCategoryFilter, setCostCategoryFilter] = useState<string>('all');
	const [costStatusFilter, setCostStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
	const [costSearch, setCostSearch] = useState('');

	// Modais
	const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
	const [generateForm, setGenerateForm] = useState({
		default_amount: 50,
		only_associates: true,
	});

	const [isNewFeeModalOpen, setIsNewFeeModalOpen] = useState(false);
	const [newFeeForm, setNewFeeForm] = useState({
		player_id: '',
		amount: 50,
		status: 'pending' as FeeStatus,
		payment_method: 'PIX',
		notes: '',
	});

	const [editingFee, setEditingFee] = useState<MonthlyFee | null>(null);
	const [editFeeForm, setEditFeeForm] = useState({
		amount: 50,
		status: 'pending' as FeeStatus,
		payment_method: 'PIX',
		notes: '',
	});

	const [isNewCostModalOpen, setIsNewCostModalOpen] = useState(false);
	const [newCostForm, setNewCostForm] = useState({
		description: '',
		category: 'Campo/Quadra',
		amount: '',
		cost_date: now.toISOString().split('T')[0],
		status: 'paid' as CostStatus,
		payment_method: 'PIX',
		notes: '',
	});

	const [editingCost, setEditingCost] = useState<FinancialCost | null>(null);
	const [editCostForm, setEditCostForm] = useState({
		description: '',
		category: 'Campo/Quadra',
		amount: '',
		cost_date: '',
		status: 'paid' as CostStatus,
		payment_method: 'PIX',
		notes: '',
	});

	const [copiedPendingList, setCopiedPendingList] = useState(false);

	// Queries
	const [summaryQuery, feesQuery, costsQuery, playersQuery] = useQueries({
		queries: [
			{
				queryKey: ['financialSummary', selectedYear, selectedMonth],
				queryFn: async (): Promise<FinancialSummary> =>
					fetchAPI(
						`/financial/summary?year=${selectedYear}&month=${selectedMonth}`
					),
				enabled: isAdmin,
			},
			{
				queryKey: ['financialFees', selectedYear, selectedMonth],
				queryFn: async (): Promise<MonthlyFee[]> =>
					fetchAPI(
						`/financial/fees?year=${selectedYear}&month=${selectedMonth}`
					),
				enabled: isAdmin,
			},
			{
				queryKey: ['financialCosts', selectedYear, selectedMonth],
				queryFn: async (): Promise<FinancialCost[]> =>
					fetchAPI(
						`/financial/costs?year=${selectedYear}&month=${selectedMonth}`
					),
				enabled: isAdmin,
			},
			{
				queryKey: ['players'],
				queryFn: async (): Promise<Player[]> => fetchAPI('/players'),
				enabled: isAdmin,
			},
		],
	});

	const summary: FinancialSummary | undefined = summaryQuery.data;
	const fees: MonthlyFee[] = useMemo(() => (feesQuery.data as MonthlyFee[]) || [], [feesQuery.data]);
	const costs: FinancialCost[] = useMemo(() => (costsQuery.data as FinancialCost[]) || [], [costsQuery.data]);
	const players: Player[] = useMemo(() => (playersQuery.data as Player[]) || [], [playersQuery.data]);

	const invalidateFinancial = () => {
		queryClient.invalidateQueries({ queryKey: ['financialSummary'] });
		queryClient.invalidateQueries({ queryKey: ['financialFees'] });
		queryClient.invalidateQueries({ queryKey: ['financialCosts'] });
	};

	// Mutações de Mensalidades
	const generateMutation = useMutation({
		mutationFn: async (): Promise<{ created_count: number; skipped_count: number }> =>
			fetchAPI('/financial/fees/generate-month', {
				method: 'POST',
				body: JSON.stringify({
					year: selectedYear,
					month: selectedMonth,
					default_amount: Number(generateForm.default_amount),
					only_associates: generateForm.only_associates,
				}),
			}),
		onSuccess: (data) => {
			invalidateFinancial();
			setIsGenerateModalOpen(false);
			alert(
				`Mensalidades geradas com sucesso!\n• Criadas: ${data.created_count}\n• Já existiam: ${data.skipped_count}`
			);
		},
		onError: (err: Error) => alert(`Erro ao gerar mensalidades: ${err.message}`),
	});

	const createFeeMutation = useMutation({
		mutationFn: () =>
			fetchAPI('/financial/fees', {
				method: 'POST',
				body: JSON.stringify({
					player_id: Number(newFeeForm.player_id),
					year: selectedYear,
					month: selectedMonth,
					amount: Number(newFeeForm.amount),
					status: newFeeForm.status,
					payment_method: newFeeForm.status === 'paid' ? newFeeForm.payment_method : null,
					notes: newFeeForm.notes || null,
				}),
			}),
		onSuccess: () => {
			invalidateFinancial();
			setIsNewFeeModalOpen(false);
			setNewFeeForm({
				player_id: '',
				amount: 50,
				status: 'pending',
				payment_method: 'PIX',
				notes: '',
			});
		},
		onError: (err: Error) => alert(`Erro ao cadastrar cobrança: ${err.message}`),
	});

	const toggleFeeStatusMutation = useMutation({
		mutationFn: ({ feeId, newStatus }: { feeId: number; newStatus: FeeStatus }) =>
			fetchAPI(`/financial/fees/${feeId}/status`, {
				method: 'PATCH',
				body: JSON.stringify({
					status: newStatus,
					payment_method: newStatus === 'paid' ? 'PIX' : null,
				}),
			}),
		onSuccess: invalidateFinancial,
		onError: (err: Error) => alert(`Erro ao alterar status: ${err.message}`),
	});

	const updateFeeMutation = useMutation({
		mutationFn: () => {
			if (!editingFee) throw new Error('Cobrança não selecionada');
			return fetchAPI(`/financial/fees/${editingFee.id_fee}`, {
				method: 'PUT',
				body: JSON.stringify({
					amount: Number(editFeeForm.amount),
					status: editFeeForm.status,
					payment_method: editFeeForm.status === 'paid' ? editFeeForm.payment_method : null,
					notes: editFeeForm.notes || null,
				}),
			});
		},
		onSuccess: () => {
			invalidateFinancial();
			setEditingFee(null);
		},
		onError: (err: Error) => alert(`Erro ao atualizar cobrança: ${err.message}`),
	});

	const deleteFeeMutation = useMutation({
		mutationFn: (feeId: number) =>
			fetchAPI(`/financial/fees/${feeId}`, { method: 'DELETE' }),
		onSuccess: invalidateFinancial,
		onError: (err: Error) => alert(`Erro ao remover cobrança: ${err.message}`),
	});

	const batchMarkPaidMutation = useMutation({
		mutationFn: () =>
			fetchAPI('/financial/fees/batch-status', {
				method: 'POST',
				body: JSON.stringify({
					fee_ids: selectedFeeIds,
					status: 'paid',
					payment_method: 'PIX',
				}),
			}),
		onSuccess: () => {
			invalidateFinancial();
			setSelectedFeeIds([]);
		},
		onError: (err: Error) => alert(`Erro ao atualizar em lote: ${err.message}`),
	});

	// Mutações de Custos
	const createCostMutation = useMutation({
		mutationFn: () =>
			fetchAPI('/financial/costs', {
				method: 'POST',
				body: JSON.stringify({
					description: newCostForm.description,
					category: newCostForm.category,
					amount: Number(newCostForm.amount),
					cost_date: new Date(newCostForm.cost_date).toISOString(),
					status: newCostForm.status,
					payment_method: newCostForm.status === 'paid' ? newCostForm.payment_method : null,
					notes: newCostForm.notes || null,
				}),
			}),
		onSuccess: () => {
			invalidateFinancial();
			setIsNewCostModalOpen(false);
			setNewCostForm({
				description: '',
				category: 'Campo/Quadra',
				amount: '',
				cost_date: now.toISOString().split('T')[0],
				status: 'paid',
				payment_method: 'PIX',
				notes: '',
			});
		},
		onError: (err: Error) => alert(`Erro ao adicionar despesa: ${err.message}`),
	});

	const updateCostMutation = useMutation({
		mutationFn: () => {
			if (!editingCost) throw new Error('Despesa não selecionada');
			return fetchAPI(`/financial/costs/${editingCost.id_cost}`, {
				method: 'PUT',
				body: JSON.stringify({
					description: editCostForm.description,
					category: editCostForm.category,
					amount: Number(editCostForm.amount),
					cost_date: new Date(editCostForm.cost_date).toISOString(),
					status: editCostForm.status,
					payment_method: editCostForm.status === 'paid' ? editCostForm.payment_method : null,
					notes: editCostForm.notes || null,
				}),
			});
		},
		onSuccess: () => {
			invalidateFinancial();
			setEditingCost(null);
		},
		onError: (err: Error) => alert(`Erro ao atualizar despesa: ${err.message}`),
	});

	const deleteCostMutation = useMutation({
		mutationFn: (costId: number) =>
			fetchAPI(`/financial/costs/${costId}`, { method: 'DELETE' }),
		onSuccess: invalidateFinancial,
		onError: (err: Error) => alert(`Erro ao remover despesa: ${err.message}`),
	});

	// Filtragem de Mensalidades
	const filteredFees = useMemo(() => {
		const q = feeSearch.toLowerCase().trim();
		return fees.filter((f) => {
			if (feeStatusFilter !== 'all' && f.status !== feeStatusFilter) return false;
			if (!q) return true;
			const pName = f.player?.nome?.toLowerCase() || '';
			const pNick = f.player?.apelido?.toLowerCase() || '';
			return pName.includes(q) || pNick.includes(q);
		});
	}, [fees, feeStatusFilter, feeSearch]);

	// Filtragem de Custos
	const filteredCosts = useMemo(() => {
		const q = costSearch.toLowerCase().trim();
		return costs.filter((c) => {
			if (costCategoryFilter !== 'all' && c.category !== costCategoryFilter) return false;
			if (costStatusFilter !== 'all' && c.status !== costStatusFilter) return false;
			if (!q) return true;
			const desc = c.description.toLowerCase();
			const note = (c.notes || '').toLowerCase();
			return desc.includes(q) || note.includes(q);
		});
	}, [costs, costCategoryFilter, costStatusFilter, costSearch]);

	// Lista de pendentes para copiar
	const pendingFeesList = useMemo(() => {
		return fees.filter((f) => f.status === 'pending');
	}, [fees]);

	const copyPendingListToClipboard = () => {
		if (pendingFeesList.length === 0) return;
		const monthName = MONTH_NAMES[selectedMonth - 1];
		let text = `⚽ *Mensalidades Pendentes - ${monthName}/${selectedYear}*\n\n`;
		let total = 0;
		pendingFeesList.forEach((f, idx) => {
			const name = f.player?.apelido || f.player?.nome || 'Jogador';
			text += `${idx + 1}. ${name} - ${formatCurrency(f.amount)}\n`;
			total += Number(f.amount);
		});
		text += `\n*Total a receber:* ${formatCurrency(total)}\n`;
		text += `*Pendentes:* ${pendingFeesList.length} mensalistas`;

		navigator.clipboard.writeText(text);
		setCopiedPendingList(true);
		setTimeout(() => setCopiedPendingList(false), 2500);
	};

	// Ações de seleção múltipla
	const toggleSelectAllFees = () => {
		if (selectedFeeIds.length === filteredFees.length) {
			setSelectedFeeIds([]);
		} else {
			setSelectedFeeIds(filteredFees.map((f) => f.id_fee));
		}
	};

	const toggleSelectFee = (id: number) => {
		setSelectedFeeIds((prev) =>
			prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
		);
	};

	// Navegação de mês
	const goToPreviousMonth = () => {
		if (selectedMonth === 1) {
			setSelectedMonth(12);
			setSelectedYear((y) => y - 1);
		} else {
			setSelectedMonth((m) => m - 1);
		}
		setSelectedFeeIds([]);
	};

	const goToNextMonth = () => {
		if (selectedMonth === 12) {
			setSelectedMonth(1);
			setSelectedYear((y) => y + 1);
		} else {
			setSelectedMonth((m) => m + 1);
		}
		setSelectedFeeIds([]);
	};

	const goToCurrentMonth = () => {
		const cur = new Date();
		setSelectedYear(cur.getFullYear());
		setSelectedMonth(cur.getMonth() + 1);
		setSelectedFeeIds([]);
	};

	// Validação de Acesso
	if (authLoading) return <Loading />;

	if (!isAdmin) {
		return (
			<div className="bg-surface border border-red-500/30 rounded-xl p-8 flex flex-col items-center text-center gap-4 max-w-lg mx-auto mt-12 animate-slide-down">
				<ShieldAlert className="w-12 h-12 text-red-400" />
				<h1 className="text-2xl font-bold text-main">Acesso Restrito</h1>
				<p className="text-sm text-muted">
					O módulo financeiro é exclusivo para administradores da associação.
				</p>
				<Link href="/" className="w-48">
					<Button variant="ghost">Voltar ao Dashboard</Button>
				</Link>
			</div>
		);
	}

	const isLoading =
		summaryQuery.isLoading || feesQuery.isLoading || costsQuery.isLoading;

	return (
		<div className="flex flex-col gap-6 animate-slide-down pb-16">
			{/* Header Principal */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2.5">
						<div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
							<Wallet className="w-6 h-6" />
						</div>
						<h1 className="text-2xl sm:text-3xl font-bold text-main tracking-tight">
							Módulo Financeiro
						</h1>
					</div>
					<p className="text-xs sm:text-sm text-muted mt-1">
						Controle de mensalidades, registro de custos e acompanhamento do saldo em caixa.
					</p>
				</div>

				{/* Seletor de Período (Mês e Ano) */}
				<div className="flex items-center gap-2 bg-surface border border-border p-1.5 rounded-xl self-start md:self-auto shadow-sm">
					<button
						type="button"
						onClick={goToPreviousMonth}
						aria-label="Mês anterior"
						className="p-1.5 text-muted hover:text-main hover:bg-hover-nav rounded-lg transition-colors cursor-pointer"
					>
						<ChevronLeft className="w-5 h-5" />
					</button>

					<div className="flex items-center gap-2 px-2 text-sm font-semibold text-main">
						<Calendar className="w-4 h-4 text-primary" />
						<span>{MONTH_NAMES[selectedMonth - 1]}</span>
						<span className="text-muted font-normal">{selectedYear}</span>
					</div>

					<button
						type="button"
						onClick={goToNextMonth}
						aria-label="Próximo mês"
						className="p-1.5 text-muted hover:text-main hover:bg-hover-nav rounded-lg transition-colors cursor-pointer"
					>
						<ChevronRight className="w-5 h-5" />
					</button>

					<button
						type="button"
						onClick={goToCurrentMonth}
						className="ml-1 text-xs px-2.5 py-1 text-primary hover:bg-primary/10 rounded-lg transition-colors font-medium cursor-pointer"
					>
						Hoje
					</button>
				</div>
			</div>

			{/* Cards de Resumo & Saldo */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Card 1: Saldo Geral Acumulado */}
				<div className="bg-surface border border-border rounded-xl p-4.5 shadow-sm flex flex-col justify-between">
					<div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider">
						<span>Saldo em Caixa</span>
						<div
							className={`p-1.5 rounded-lg ${(summary?.overall.total_balance ?? 0) >= 0
									? 'bg-emerald-500/10 text-emerald-400'
									: 'bg-red-500/10 text-red-400'
								}`}
						>
							<Coins className="w-4 h-4" />
						</div>
					</div>
					<div className="mt-3">
						<div
							className={`text-2xl font-bold tracking-tight ${(summary?.overall.total_balance ?? 0) >= 0
									? 'text-emerald-400'
									: 'text-red-400'
								}`}
						>
							{formatCurrency(summary?.overall.total_balance ?? 0)}
						</div>
						<p className="text-[11px] text-muted mt-1">
							Receitas: {formatCurrency(summary?.overall.total_revenue ?? 0)} | Despesas:{' '}
							{formatCurrency(summary?.overall.total_expenses ?? 0)}
						</p>
					</div>
				</div>

				{/* Card 2: Saldo do Mês */}
				<div className="bg-surface border border-border rounded-xl p-4.5 shadow-sm flex flex-col justify-between">
					<div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider">
						<span>Saldo do Mês</span>
						<div
							className={`p-1.5 rounded-lg ${(summary?.period.period_balance ?? 0) >= 0
									? 'bg-emerald-500/10 text-emerald-400'
									: 'bg-amber-500/10 text-amber-400'
								}`}
						>
							{(summary?.period.period_balance ?? 0) >= 0 ? (
								<TrendingUp className="w-4 h-4" />
							) : (
								<TrendingDown className="w-4 h-4" />
							)}
						</div>
					</div>
					<div className="mt-3">
						<div
							className={`text-2xl font-bold tracking-tight ${(summary?.period.period_balance ?? 0) >= 0
									? 'text-emerald-400'
									: 'text-amber-400'
								}`}
						>
							{formatCurrency(summary?.period.period_balance ?? 0)}
						</div>
						<p className="text-[11px] text-muted mt-1">
							{(summary?.period.period_balance ?? 0) >= 0
								? 'Superávit no período'
								: 'Déficit no período'}
						</p>
					</div>
				</div>

				{/* Card 3: Mensalidades Recebidas */}
				<div className="bg-surface border border-border rounded-xl p-4.5 shadow-sm flex flex-col justify-between">
					<div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider">
						<span>Recebido no Mês</span>
						<div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
							<ArrowDownRight className="w-4 h-4" />
						</div>
					</div>
					<div className="mt-3">
						<div className="text-2xl font-bold text-main tracking-tight">
							{formatCurrency(summary?.period.total_fees_paid ?? 0)}
						</div>
						<div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted">
							<span className="text-emerald-400 font-medium">
								{summary?.period.fees_count_paid ?? 0} pagas
							</span>
							<span>•</span>
							<span className="text-amber-400 font-medium">
								{summary?.period.fees_count_pending ?? 0} pendentes
							</span>
						</div>
					</div>
				</div>

				{/* Card 4: Custos do Mês */}
				<div className="bg-surface border border-border rounded-xl p-4.5 shadow-sm flex flex-col justify-between">
					<div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider">
						<span>Custos no Mês</span>
						<div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
							<ArrowUpRight className="w-4 h-4" />
						</div>
					</div>
					<div className="mt-3">
						<div className="text-2xl font-bold text-main tracking-tight">
							{formatCurrency(summary?.period.total_costs_paid ?? 0)}
						</div>
						<p className="text-[11px] text-muted mt-1">
							{costs.length} despesa{costs.length === 1 ? '' : 's'} registrada
							{costs.length === 1 ? '' : 's'}
						</p>
					</div>
				</div>
			</div>

			{/* Barra de Abas e Ações */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setActiveTab('fees')}
						className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'fees'
								? 'bg-primary text-white shadow-sm'
								: 'bg-surface text-muted hover:text-main hover:bg-hover-nav border border-border'
							}`}
					>
						<Users className="w-4 h-4" />
						<span>Mensalidades</span>
						<span
							className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'fees'
									? 'bg-white/20 text-white'
									: 'bg-background text-muted'
								}`}
						>
							{fees.length}
						</span>
					</button>

					<button
						type="button"
						onClick={() => setActiveTab('costs')}
						className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'costs'
								? 'bg-primary text-white shadow-sm'
								: 'bg-surface text-muted hover:text-main hover:bg-hover-nav border border-border'
							}`}
					>
						<Receipt className="w-4 h-4" />
						<span>Custos e Despesas</span>
						<span
							className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'costs'
									? 'bg-white/20 text-white'
									: 'bg-background text-muted'
								}`}
						>
							{costs.length}
						</span>
					</button>

					<button
						type="button"
						onClick={() => setActiveTab('flow')}
						className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'flow'
								? 'bg-primary text-white shadow-sm'
								: 'bg-surface text-muted hover:text-main hover:bg-hover-nav border border-border'
							}`}
					>
						<TrendingUp className="w-4 h-4" />
						<span>Fluxo & Relatório</span>
					</button>
				</div>

				{/* Botões de Ação no topo */}
				<div className="flex items-center gap-2 flex-wrap">
					{activeTab === 'fees' && (
						<>
							<Button
								variant="ghost"
								onClick={() => setIsGenerateModalOpen(true)}
								className="!w-auto flex items-center gap-1.5 text-xs px-3 py-2"
							>
								<Sparkles className="w-3.5 h-3.5 text-amber-400" />
								<span>Gerar Cobranças do Mês</span>
							</Button>

							<Button
								onClick={() => setIsNewFeeModalOpen(true)}
								className="!w-auto flex items-center gap-1.5 text-xs px-3 py-2"
							>
								<Plus className="w-3.5 h-3.5" />
								<span>Nova Cobrança</span>
							</Button>
						</>
					)}

					{activeTab === 'costs' && (
						<Button
							onClick={() => setIsNewCostModalOpen(true)}
							className="!w-auto flex items-center gap-1.5 text-xs px-3 py-2"
						>
							<Plus className="w-3.5 h-3.5" />
							<span>Novo Custo / Despesa</span>
						</Button>
					)}

					{activeTab === 'flow' && (
						<Button
							variant="ghost"
							onClick={copyPendingListToClipboard}
							disabled={pendingFeesList.length === 0}
							className="!w-auto flex items-center gap-1.5 text-xs px-3 py-2"
						>
							{copiedPendingList ? (
								<>
									<Check className="w-3.5 h-3.5 text-emerald-400" />
									<span>Copiado!</span>
								</>
							) : (
								<>
									<Copy className="w-3.5 h-3.5" />
									<span>Copiar Lista de Inadimplentes</span>
								</>
							)}
						</Button>
					)}
				</div>
			</div>

			{isLoading && <Loading />}

			{/* ============================================================== */}
			{/* ABA 1: MENSALIDADES */}
			{/* ============================================================== */}
			{!isLoading && activeTab === 'fees' && (
				<div className="flex flex-col gap-4">
					{/* Filtros da tabela de mensalidades */}
					<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface border border-border p-3 rounded-xl">
						<div className="flex items-center gap-2 flex-1 max-w-md">
							<div className="relative w-full">
								<Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
								<input
									type="text"
									placeholder="Buscar mensalista por nome..."
									value={feeSearch}
									onChange={(e) => setFeeSearch(e.target.value)}
									className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-lg text-main text-xs focus:outline-none focus:border-primary transition-colors"
								/>
							</div>
						</div>

						<div className="flex items-center gap-2 flex-wrap">
							{/* Filtro de Status */}
							<div className="flex items-center gap-1 bg-background border border-border p-1 rounded-lg">
								<button
									type="button"
									onClick={() => setFeeStatusFilter('all')}
									className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${feeStatusFilter === 'all'
											? 'bg-primary text-white'
											: 'text-muted hover:text-main'
										}`}
								>
									Todos ({fees.length})
								</button>
								<button
									type="button"
									onClick={() => setFeeStatusFilter('paid')}
									className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${feeStatusFilter === 'paid'
											? 'bg-emerald-600 text-white'
											: 'text-muted hover:text-main'
										}`}
								>
									Pagos ({summary?.period.fees_count_paid ?? 0})
								</button>
								<button
									type="button"
									onClick={() => setFeeStatusFilter('pending')}
									className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${feeStatusFilter === 'pending'
											? 'bg-amber-600 text-white'
											: 'text-muted hover:text-main'
										}`}
								>
									Pendentes ({summary?.period.fees_count_pending ?? 0})
								</button>
								<button
									type="button"
									onClick={() => setFeeStatusFilter('exempt')}
									className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${feeStatusFilter === 'exempt'
											? 'bg-slate-600 text-white'
											: 'text-muted hover:text-main'
										}`}
								>
									Isentos ({summary?.period.fees_count_exempt ?? 0})
								</button>
							</div>

							{/* Ação em lote */}
							{selectedFeeIds.length > 0 && (
								<Button
									variant="ghost"
									onClick={() => batchMarkPaidMutation.mutate()}
									className="!w-auto flex items-center gap-1.5 text-xs px-2.5 py-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
								>
									<CheckCircle2 className="w-3.5 h-3.5" />
									<span>Marcar {selectedFeeIds.length} como Pago</span>
								</Button>
							)}
						</div>
					</div>

					{/* Tabela de Mensalidades */}
					{filteredFees.length === 0 ? (
						<div className="bg-surface border border-border rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
							<Users className="w-10 h-10 text-muted opacity-50" />
							<h3 className="text-base font-semibold text-main">
								Nenhuma cobrança encontrada
							</h3>
							<p className="text-xs text-muted max-w-md">
								{fees.length === 0
									? `Ainda não há mensalidades geradas para ${MONTH_NAMES[selectedMonth - 1]}/${selectedYear}. Você pode gerá-las automaticamente com um clique!`
									: 'Nenhum jogador corresponde aos filtros de busca selecionados.'}
							</p>
							{fees.length === 0 && (
								<Button
									onClick={() => setIsGenerateModalOpen(true)}
									className="!w-auto flex items-center gap-1.5 text-xs px-3.5 py-2 mt-2"
								>
									<Sparkles className="w-4 h-4 text-amber-300" />
									<span>Gerar Mensalidades do Mês</span>
								</Button>
							)}
						</div>
					) : (
						<div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs">
									<thead className="bg-background/80 text-muted border-b border-border font-semibold uppercase tracking-wider text-[10px]">
										<tr>
											<th className="p-3 w-8 text-center">
												<input
													type="checkbox"
													aria-label="Selecionar todos os mensalistas"
													checked={
														selectedFeeIds.length > 0 &&
														selectedFeeIds.length === filteredFees.length
													}
													onChange={toggleSelectAllFees}
													className="rounded border-border text-primary cursor-pointer"
												/>
											</th>
											<th className="p-3">Mensalista</th>
											<th className="p-3">Tipo</th>
											<th className="p-3">Valor</th>
											<th className="p-3 text-center">Status</th>
											<th className="p-3">Data Pgto</th>
											<th className="p-3">Forma</th>
											<th className="p-3">Observação</th>
											<th className="p-3 text-right">Ações</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{filteredFees.map((fee) => {
											const isSelected = selectedFeeIds.includes(fee.id_fee);
											const isPaid = fee.status === 'paid';
											const isPending = fee.status === 'pending';
											const isExempt = fee.status === 'exempt';

											return (
												<tr
													key={fee.id_fee}
													className={`transition-colors hover:bg-hover-nav/50 ${isSelected ? 'bg-primary/5' : ''
														}`}
												>
													<td className="p-3 text-center">
														<input
															type="checkbox"
															aria-label={`Selecionar ${fee.player?.nome || 'jogador'}`}
															checked={isSelected}
															onChange={() => toggleSelectFee(fee.id_fee)}
															className="rounded border-border text-primary cursor-pointer"
														/>
													</td>

													{/* Nome / Jogador */}
													<td className="p-3">
														<div className="font-semibold text-main text-sm">
															{fee.player?.nome || 'Jogador Desconhecido'}
														</div>
														{fee.player?.apelido && (
															<div className="text-[11px] text-muted">
																&quot;{fee.player.apelido}&quot;
															</div>
														)}
													</td>

													{/* Tipo (Sócio / Convidado) */}
													<td className="p-3">
														{fee.player?.is_associate ? (
															<span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
																Mensalista
															</span>
														) : (
															<span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
																Convidado
															</span>
														)}
													</td>

													{/* Valor */}
													<td className="p-3 font-semibold text-main text-sm">
														{formatCurrency(fee.amount)}
													</td>

													{/* Status Badge + Toggle */}
													<td className="p-3 text-center">
														<button
															type="button"
															onClick={() =>
																toggleFeeStatusMutation.mutate({
																	feeId: fee.id_fee,
																	newStatus: isPaid ? 'pending' : 'paid',
																})
															}
															title={
																isPaid
																	? 'Clique para marcar como Pendente'
																	: 'Clique para marcar como Pago'
															}
															className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${isPaid
																	? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
																	: isPending
																		? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30'
																		: 'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25 border border-slate-500/30'
																}`}
														>
															{isPaid && <Check className="w-3.5 h-3.5" />}
															{isPending && <Clock className="w-3.5 h-3.5" />}
															<span>
																{isPaid ? 'Pago' : isPending ? 'Pendente' : 'Isento'}
															</span>
														</button>
													</td>

													{/* Data Pagamento */}
													<td className="p-3 text-muted">
														{formatDate(fee.paid_at)}
													</td>

													{/* Forma de Pagamento */}
													<td className="p-3 text-muted">
														{fee.payment_method ? (
															<span className="px-1.5 py-0.5 rounded bg-background border border-border text-[11px] text-main">
																{fee.payment_method}
															</span>
														) : (
															'—'
														)}
													</td>

													{/* Observação */}
													<td className="p-3 text-muted max-w-xs truncate">
														{fee.notes || '—'}
													</td>

													{/* Ações */}
													<td className="p-3 text-right">
														<div className="flex items-center justify-end gap-1">
															<button
																type="button"
																onClick={() => {
																	setEditingFee(fee);
																	setEditFeeForm({
																		amount: Number(fee.amount),
																		status: fee.status,
																		payment_method: fee.payment_method || 'PIX',
																		notes: fee.notes || '',
																	});
																}}
																title="Editar cobrança"
																className="p-1.5 text-muted hover:text-main hover:bg-hover-nav rounded transition-colors cursor-pointer"
															>
																<Pencil className="w-3.5 h-3.5" />
															</button>
															<button
																type="button"
																onClick={() => {
																	if (
																		confirm(
																			`Deseja realmente excluir a cobrança de ${fee.player?.nome || 'jogador'
																			}?`
																		)
																	) {
																		deleteFeeMutation.mutate(fee.id_fee);
																	}
																}}
																title="Excluir cobrança"
																className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
															>
																<Trash2 className="w-3.5 h-3.5" />
															</button>
														</div>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>

							{/* Rodapé da tabela com totais parciais */}
							<div className="bg-background/80 border-t border-border p-3 flex flex-col sm:flex-row items-center justify-between text-xs text-muted gap-2">
								<div>
									Exibindo <strong>{filteredFees.length}</strong> de{' '}
									<strong>{fees.length}</strong> cobranças
								</div>
								<div className="flex items-center gap-4">
									<span>
										Total Pago:{' '}
										<strong className="text-emerald-400">
											{formatCurrency(
												filteredFees
													.filter((f) => f.status === 'paid')
													.reduce((acc, f) => acc + Number(f.amount), 0)
											)}
										</strong>
									</span>
									<span>
										Total Pendente:{' '}
										<strong className="text-amber-400">
											{formatCurrency(
												filteredFees
													.filter((f) => f.status === 'pending')
													.reduce((acc, f) => acc + Number(f.amount), 0)
											)}
										</strong>
									</span>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* ============================================================== */}
			{/* ABA 2: CUSTOS E DESPESAS */}
			{/* ============================================================== */}
			{!isLoading && activeTab === 'costs' && (
				<div className="flex flex-col gap-4">
					{/* Filtros da tabela de custos */}
					<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface border border-border p-3 rounded-xl">
						<div className="flex items-center gap-2 flex-1 max-w-md">
							<div className="relative w-full">
								<Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
								<input
									type="text"
									placeholder="Buscar por descrição ou observação..."
									value={costSearch}
									onChange={(e) => setCostSearch(e.target.value)}
									className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-lg text-main text-xs focus:outline-none focus:border-primary transition-colors"
								/>
							</div>
						</div>

						<div className="flex items-center gap-2 flex-wrap">
							{/* Filtro por Categoria */}
							<Select
								size="sm"
								value={costCategoryFilter}
								onChange={(e) => setCostCategoryFilter(e.target.value)}
								aria-label="Filtrar por Categoria"
								containerClassName="w-auto min-w-[170px]"
							>
								<option value="all">Todas as Categorias</option>
								{COST_CATEGORIES.map((cat) => (
									<option key={cat} value={cat}>
										{cat}
									</option>
								))}
							</Select>

							{/* Filtro por Status */}
							<div className="flex items-center gap-1 bg-background border border-border p-1 rounded-lg">
								<button
									type="button"
									onClick={() => setCostStatusFilter('all')}
									className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${costStatusFilter === 'all'
											? 'bg-primary text-white'
											: 'text-muted hover:text-main'
										}`}
								>
									Todos ({costs.length})
								</button>
								<button
									type="button"
									onClick={() => setCostStatusFilter('paid')}
									className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${costStatusFilter === 'paid'
											? 'bg-emerald-600 text-white'
											: 'text-muted hover:text-main'
										}`}
								>
									Pagos
								</button>
								<button
									type="button"
									onClick={() => setCostStatusFilter('pending')}
									className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${costStatusFilter === 'pending'
											? 'bg-amber-600 text-white'
											: 'text-muted hover:text-main'
										}`}
								>
									Pendentes
								</button>
							</div>
						</div>
					</div>

					{/* Tabela de Custos */}
					{filteredCosts.length === 0 ? (
						<div className="bg-surface border border-border rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
							<Receipt className="w-10 h-10 text-muted opacity-50" />
							<h3 className="text-base font-semibold text-main">
								Nenhuma despesa encontrada
							</h3>
							<p className="text-xs text-muted max-w-md">
								{costs.length === 0
									? `Ainda não há custos registrados em ${MONTH_NAMES[selectedMonth - 1]}/${selectedYear}.`
									: 'Nenhuma despesa corresponde aos filtros selecionados.'}
							</p>
							<Button
								onClick={() => setIsNewCostModalOpen(true)}
								className="!w-auto flex items-center gap-1.5 text-xs px-3.5 py-2 mt-2"
							>
								<Plus className="w-4 h-4" />
								<span>Registrar Despesa</span>
							</Button>
						</div>
					) : (
						<div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs">
									<thead className="bg-background/80 text-muted border-b border-border font-semibold uppercase tracking-wider text-[10px]">
										<tr>
											<th className="p-3">Descrição</th>
											<th className="p-3">Categoria</th>
											<th className="p-3">Data</th>
											<th className="p-3">Valor</th>
											<th className="p-3 text-center">Status</th>
											<th className="p-3">Forma</th>
											<th className="p-3">Observação</th>
											<th className="p-3 text-right">Ações</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{filteredCosts.map((cost) => (
											<tr
												key={cost.id_cost}
												className="transition-colors hover:bg-hover-nav/50"
											>
												{/* Descrição */}
												<td className="p-3 font-semibold text-main text-sm">
													{cost.description}
												</td>

												{/* Categoria */}
												<td className="p-3">
													<span className="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
														{cost.category}
													</span>
												</td>

												{/* Data */}
												<td className="p-3 text-muted">
													{formatDate(cost.cost_date)}
												</td>

												{/* Valor */}
												<td className="p-3 font-bold text-rose-400 text-sm">
													{formatCurrency(cost.amount)}
												</td>

												{/* Status */}
												<td className="p-3 text-center">
													<span
														className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cost.status === 'paid'
																? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
																: 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
															}`}
													>
														{cost.status === 'paid' ? 'Pago' : 'Pendente'}
													</span>
												</td>

												{/* Forma */}
												<td className="p-3 text-muted">
													{cost.payment_method || '—'}
												</td>

												{/* Observação */}
												<td className="p-3 text-muted max-w-xs truncate">
													{cost.notes || '—'}
												</td>

												{/* Ações */}
												<td className="p-3 text-right">
													<div className="flex items-center justify-end gap-1">
														<button
															type="button"
															onClick={() => {
																setEditingCost(cost);
																setEditCostForm({
																	description: cost.description,
																	category: cost.category,
																	amount: String(cost.amount),
																	cost_date: cost.cost_date
																		? cost.cost_date.split('T')[0]
																		: '',
																	status: cost.status,
																	payment_method: cost.payment_method || 'PIX',
																	notes: cost.notes || '',
																});
															}}
															title="Editar despesa"
															className="p-1.5 text-muted hover:text-main hover:bg-hover-nav rounded transition-colors cursor-pointer"
														>
															<Pencil className="w-3.5 h-3.5" />
														</button>
														<button
															type="button"
															onClick={() => {
																if (
																	confirm(
																		`Deseja realmente excluir a despesa "${cost.description}"?`
																	)
																) {
																	deleteCostMutation.mutate(cost.id_cost);
																}
															}}
															title="Excluir despesa"
															className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
														>
															<Trash2 className="w-3.5 h-3.5" />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Rodapé com total de custos */}
							<div className="bg-background/80 border-t border-border p-3 flex items-center justify-between text-xs text-muted">
								<div>
									Total de <strong>{filteredCosts.length}</strong> registro(s)
								</div>
								<div>
									Total de Despesas:{' '}
									<strong className="text-rose-400 text-sm">
										{formatCurrency(
											filteredCosts.reduce((acc, c) => acc + Number(c.amount), 0)
										)}
									</strong>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* ============================================================== */}
			{/* ABA 3: FLUXO & RELATÓRIO */}
			{/* ============================================================== */}
			{!isLoading && activeTab === 'flow' && (
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Tendência dos últimos 6 meses */}
					<div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-base font-bold text-main">
									Histórico e Fluxo dos Últimos Meses
								</h3>
								<p className="text-xs text-muted mt-0.5">
									Comparativo mensal de receitas recebidas versus despesas pagas.
								</p>
							</div>
						</div>

						<div className="overflow-x-auto">
							<table className="w-full text-left text-xs">
								<thead className="bg-background/80 text-muted border-b border-border font-semibold uppercase tracking-wider text-[10px]">
									<tr>
										<th className="p-3">Mês / Ano</th>
										<th className="p-3">Receitas</th>
										<th className="p-3">Despesas</th>
										<th className="p-3 text-right">Saldo do Mês</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/60">
									{summary?.trends?.map((item) => {
										const isPositive = item.balance >= 0;
										return (
											<tr
												key={`${item.year}-${item.month}`}
												className={`transition-colors hover:bg-hover-nav/40 ${item.year === selectedYear &&
														item.month === selectedMonth
														? 'bg-primary/5 font-semibold'
														: ''
													}`}
											>
												<td className="p-3 font-medium text-main">
													{item.label}
													{item.year === selectedYear &&
														item.month === selectedMonth && (
															<span className="ml-1.5 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px]">
																Atual
															</span>
														)}
												</td>
												<td className="p-3 text-emerald-400 font-semibold">
													{formatCurrency(item.revenue)}
												</td>
												<td className="p-3 text-rose-400 font-semibold">
													{formatCurrency(item.costs)}
												</td>
												<td
													className={`p-3 text-right font-bold ${isPositive ? 'text-emerald-400' : 'text-amber-400'
														}`}
												>
													{formatCurrency(item.balance)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>

					{/* Lista Rápida de Inadimplência do Mês */}
					<div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-base font-bold text-main">
									Inadimplentes ({pendingFeesList.length})
								</h3>
								<p className="text-xs text-muted mt-0.5">
									{MONTH_NAMES[selectedMonth - 1]}/{selectedYear}
								</p>
							</div>
							<button
								type="button"
								onClick={copyPendingListToClipboard}
								disabled={pendingFeesList.length === 0}
								title="Copiar lista para o WhatsApp"
								className="p-1.5 text-muted hover:text-main hover:bg-hover-nav rounded-lg transition-colors cursor-pointer disabled:opacity-50"
							>
								{copiedPendingList ? (
									<Check className="w-4 h-4 text-emerald-400" />
								) : (
									<Copy className="w-4 h-4" />
								)}
							</button>
						</div>

						{pendingFeesList.length === 0 ? (
							<div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center flex flex-col items-center gap-2">
								<CheckCircle2 className="w-8 h-8 text-emerald-400" />
								<span className="text-sm font-bold text-emerald-300">
									Tudo em dia!
								</span>
								<p className="text-xs text-muted">
									Nenhum mensalista com pagamento pendente neste mês.
								</p>
							</div>
						) : (
							<div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
								{pendingFeesList.map((f, idx) => (
									<div
										key={f.id_fee}
										className="p-2.5 rounded-lg bg-background border border-border flex items-center justify-between text-xs"
									>
										<div className="flex items-center gap-2">
											<span className="w-5 text-muted font-mono text-[11px]">
												{idx + 1}.
											</span>
											<div>
												<div className="font-semibold text-main">
													{f.player?.apelido || f.player?.nome}
												</div>
												{f.player?.apelido && (
													<div className="text-[10px] text-muted">
														{f.player.nome}
													</div>
												)}
											</div>
										</div>
										<div className="flex items-center gap-2">
											<span className="font-bold text-amber-400">
												{formatCurrency(f.amount)}
											</span>
											<button
												type="button"
												onClick={() =>
													toggleFeeStatusMutation.mutate({
														feeId: f.id_fee,
														newStatus: 'paid',
													})
												}
												title="Dar baixa"
												className="p-1 text-muted hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors cursor-pointer"
											>
												<Check className="w-3.5 h-3.5" />
											</button>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			)}

			{/* ============================================================== */}
			{/* MODAL 1: GERAR MENSALIDADES DO MÊS */}
			{/* ============================================================== */}
			<Modal
				isOpen={isGenerateModalOpen}
				onClose={() => setIsGenerateModalOpen(false)}
				title="Gerar Cobranças do Mês"
				maxWidth="max-w-md"
			>
				<div className="flex flex-col gap-4 text-xs">
					<p className="text-muted leading-relaxed">
						Isso irá criar as cobranças de mensalidade para a competência de{' '}
						<strong className="text-main">
							{MONTH_NAMES[selectedMonth - 1]}/{selectedYear}
						</strong>
						. Se algum jogador já tiver cobrança gerada para este mês, ele não será duplicado.
					</p>

					<FormField label="Valor Padrão da Mensalidade (R$)">
						<Input
							type="number"
							step="0.01"
							min="0"
							value={generateForm.default_amount}
							onChange={(e) =>
								setGenerateForm({
									...generateForm,
									default_amount: Number(e.target.value),
								})
							}
						/>
					</FormField>

					<label className="flex items-center gap-2 text-main cursor-pointer">
						<input
							type="checkbox"
							checked={generateForm.only_associates}
							onChange={(e) =>
								setGenerateForm({
									...generateForm,
									only_associates: e.target.checked,
								})
							}
							className="rounded border-border text-primary cursor-pointer"
						/>
						<span>Gerar apenas para associados / mensalistas</span>
					</label>

					<div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
						<Button
							variant="ghost"
							onClick={() => setIsGenerateModalOpen(false)}
							className="!w-auto"
						>
							Cancelar
						</Button>
						<Button
							onClick={() => generateMutation.mutate()}
							disabled={generateMutation.isPending}
							className="!w-auto"
						>
							{generateMutation.isPending ? 'Gerando...' : 'Gerar Mensalidades'}
						</Button>
					</div>
				</div>
			</Modal>

			{/* ============================================================== */}
			{/* MODAL 2: NOVA COBRANÇA INDIVIDUAL */}
			{/* ============================================================== */}
			<Modal
				isOpen={isNewFeeModalOpen}
				onClose={() => setIsNewFeeModalOpen(false)}
				title="Nova Cobrança Individual"
				maxWidth="max-w-md"
			>
				<div className="flex flex-col gap-3 text-xs">
					<FormField label="Jogador / Mensalista">
						<Select
							value={newFeeForm.player_id}
							onChange={(e) =>
								setNewFeeForm({ ...newFeeForm, player_id: e.target.value })
							}
						>
							<option value="">Selecione um jogador...</option>
							{players.map((p) => (
								<option key={p.id_player} value={p.id_player}>
									{p.nome} {p.apelido ? `(${p.apelido})` : ''} -{' '}
									{p.is_associate ? 'Mensalista' : 'Convidado'}
								</option>
							))}
						</Select>
					</FormField>

					<FormField label="Valor (R$)">
						<Input
							type="number"
							step="0.01"
							min="0"
							value={newFeeForm.amount}
							onChange={(e) =>
								setNewFeeForm({
									...newFeeForm,
									amount: Number(e.target.value),
								})
							}
						/>
					</FormField>

					<FormField label="Status Inicial">
						<Select
							value={newFeeForm.status}
							onChange={(e) =>
								setNewFeeForm({
									...newFeeForm,
									status: e.target.value as FeeStatus,
								})
							}
						>
							<option value="pending">Pendente</option>
							<option value="paid">Pago</option>
							<option value="exempt">Isento</option>
						</Select>
					</FormField>

					{newFeeForm.status === 'paid' && (
						<FormField label="Forma de Pagamento">
							<Select
								value={newFeeForm.payment_method}
								onChange={(e) =>
									setNewFeeForm({
										...newFeeForm,
										payment_method: e.target.value,
									})
								}
							>
								{PAYMENT_METHODS.map((method) => (
									<option key={method} value={method}>
										{method}
									</option>
								))}
							</Select>
						</FormField>
					)}

					<FormField label="Observação (Opcional)">
						<Input
							type="text"
							placeholder="Ex: Pagou adiantado / Acordo"
							value={newFeeForm.notes}
							onChange={(e) =>
								setNewFeeForm({ ...newFeeForm, notes: e.target.value })
							}
						/>
					</FormField>

					<div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
						<Button
							variant="ghost"
							onClick={() => setIsNewFeeModalOpen(false)}
							className="!w-auto"
						>
							Cancelar
						</Button>
						<Button
							onClick={() => createFeeMutation.mutate()}
							disabled={createFeeMutation.isPending || !newFeeForm.player_id}
							className="!w-auto"
						>
							{createFeeMutation.isPending ? 'Salvando...' : 'Cadastrar'}
						</Button>
					</div>
				</div>
			</Modal>

			{/* ============================================================== */}
			{/* MODAL 3: EDITAR COBRANÇA */}
			{/* ============================================================== */}
			<Modal
				isOpen={Boolean(editingFee)}
				onClose={() => setEditingFee(null)}
				title={`Editar Cobrança - ${editingFee?.player?.nome || ''}`}
				maxWidth="max-w-md"
			>
				<div className="flex flex-col gap-3 text-xs">
					<FormField label="Valor (R$)">
						<Input
							type="number"
							step="0.01"
							min="0"
							value={editFeeForm.amount}
							onChange={(e) =>
								setEditFeeForm({
									...editFeeForm,
									amount: Number(e.target.value),
								})
							}
						/>
					</FormField>

					<FormField label="Status">
						<Select
							value={editFeeForm.status}
							onChange={(e) =>
								setEditFeeForm({
									...editFeeForm,
									status: e.target.value as FeeStatus,
								})
							}
						>
							<option value="pending">Pendente</option>
							<option value="paid">Pago</option>
							<option value="exempt">Isento</option>
						</Select>
					</FormField>

					{editFeeForm.status === 'paid' && (
						<FormField label="Forma de Pagamento">
							<Select
								value={editFeeForm.payment_method}
								onChange={(e) =>
									setEditFeeForm({
										...editFeeForm,
										payment_method: e.target.value,
									})
								}
							>
								{PAYMENT_METHODS.map((method) => (
									<option key={method} value={method}>
										{method}
									</option>
								))}
							</Select>
						</FormField>
					)}

					<FormField label="Observação">
						<Input
							type="text"
							placeholder="Observações adicionais..."
							value={editFeeForm.notes}
							onChange={(e) =>
								setEditFeeForm({ ...editFeeForm, notes: e.target.value })
							}
						/>
					</FormField>

					<div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
						<Button
							variant="ghost"
							onClick={() => setEditingFee(null)}
							className="!w-auto"
						>
							Cancelar
						</Button>
						<Button
							onClick={() => updateFeeMutation.mutate()}
							disabled={updateFeeMutation.isPending}
							className="!w-auto"
						>
							{updateFeeMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
						</Button>
					</div>
				</div>
			</Modal>

			{/* ============================================================== */}
			{/* MODAL 4: NOVO CUSTO / DESPESA */}
			{/* ============================================================== */}
			<Modal
				isOpen={isNewCostModalOpen}
				onClose={() => setIsNewCostModalOpen(false)}
				title="Registrar Novo Custo / Despesa"
				maxWidth="max-w-md"
			>
				<div className="flex flex-col gap-3 text-xs">
					<FormField label="Descrição da Despesa">
						<Input
							type="text"
							placeholder="Ex: Aluguel da quadra de Novembro"
							value={newCostForm.description}
							onChange={(e) =>
								setNewCostForm({ ...newCostForm, description: e.target.value })
							}
						/>
					</FormField>

					<div className="grid grid-cols-2 gap-3">
						<FormField label="Categoria">
							<Select
								value={newCostForm.category}
								onChange={(e) =>
									setNewCostForm({ ...newCostForm, category: e.target.value })
								}
							>
								{COST_CATEGORIES.map((cat) => (
									<option key={cat} value={cat}>
										{cat}
									</option>
								))}
							</Select>
						</FormField>

						<FormField label="Valor (R$)">
							<Input
								type="number"
								step="0.01"
								min="0"
								placeholder="0.00"
								value={newCostForm.amount}
								onChange={(e) =>
									setNewCostForm({ ...newCostForm, amount: e.target.value })
								}
							/>
						</FormField>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<FormField label="Data">
							<Input
								type="date"
								value={newCostForm.cost_date}
								onChange={(e) =>
									setNewCostForm({ ...newCostForm, cost_date: e.target.value })
								}
							/>
						</FormField>

						<FormField label="Status">
							<Select
								value={newCostForm.status}
								onChange={(e) =>
									setNewCostForm({
										...newCostForm,
										status: e.target.value as CostStatus,
									})
								}
							>
								<option value="paid">Pago</option>
								<option value="pending">Pendente</option>
							</Select>
						</FormField>
					</div>

					{newCostForm.status === 'paid' && (
						<FormField label="Forma de Pagamento">
							<Select
								value={newCostForm.payment_method}
								onChange={(e) =>
									setNewCostForm({
										...newCostForm,
										payment_method: e.target.value,
									})
								}
							>
								{PAYMENT_METHODS.map((method) => (
									<option key={method} value={method}>
										{method}
									</option>
								))}
							</Select>
						</FormField>
					)}

					<FormField label="Observação (Opcional)">
						<Input
							type="text"
							placeholder="Detalhes adicionais, comprovante, etc."
							value={newCostForm.notes}
							onChange={(e) =>
								setNewCostForm({ ...newCostForm, notes: e.target.value })
							}
						/>
					</FormField>

					<div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
						<Button
							variant="ghost"
							onClick={() => setIsNewCostModalOpen(false)}
							className="!w-auto"
						>
							Cancelar
						</Button>
						<Button
							onClick={() => createCostMutation.mutate()}
							disabled={
								createCostMutation.isPending ||
								!newCostForm.description ||
								!newCostForm.amount
							}
							className="!w-auto"
						>
							{createCostMutation.isPending ? 'Salvando...' : 'Registrar'}
						</Button>
					</div>
				</div>
			</Modal>

			{/* ============================================================== */}
			{/* MODAL 5: EDITAR CUSTO */}
			{/* ============================================================== */}
			<Modal
				isOpen={Boolean(editingCost)}
				onClose={() => setEditingCost(null)}
				title="Editar Despesa"
				maxWidth="max-w-md"
			>
				<div className="flex flex-col gap-3 text-xs">
					<FormField label="Descrição da Despesa">
						<Input
							type="text"
							value={editCostForm.description}
							onChange={(e) =>
								setEditCostForm({
									...editCostForm,
									description: e.target.value,
								})
							}
						/>
					</FormField>

					<div className="grid grid-cols-2 gap-3">
						<FormField label="Categoria">
							<Select
								value={editCostForm.category}
								onChange={(e) =>
									setEditCostForm({ ...editCostForm, category: e.target.value })
								}
							>
								{COST_CATEGORIES.map((cat) => (
									<option key={cat} value={cat}>
										{cat}
									</option>
								))}
							</Select>
						</FormField>

						<FormField label="Valor (R$)">
							<Input
								type="number"
								step="0.01"
								min="0"
								value={editCostForm.amount}
								onChange={(e) =>
									setEditCostForm({ ...editCostForm, amount: e.target.value })
								}
							/>
						</FormField>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<FormField label="Data">
							<Input
								type="date"
								value={editCostForm.cost_date}
								onChange={(e) =>
									setEditCostForm({
										...editCostForm,
										cost_date: e.target.value,
									})
								}
							/>
						</FormField>

						<FormField label="Status">
							<Select
								value={editCostForm.status}
								onChange={(e) =>
									setEditCostForm({
										...editCostForm,
										status: e.target.value as CostStatus,
									})
								}
							>
								<option value="paid">Pago</option>
								<option value="pending">Pendente</option>
							</Select>
						</FormField>
					</div>

					{editCostForm.status === 'paid' && (
						<FormField label="Forma de Pagamento">
							<Select
								value={editCostForm.payment_method}
								onChange={(e) =>
									setEditCostForm({
										...editCostForm,
										payment_method: e.target.value,
									})
								}
							>
								{PAYMENT_METHODS.map((method) => (
									<option key={method} value={method}>
										{method}
									</option>
								))}
							</Select>
						</FormField>
					)}

					<FormField label="Observação">
						<Input
							type="text"
							value={editCostForm.notes}
							onChange={(e) =>
								setEditCostForm({ ...editCostForm, notes: e.target.value })
							}
						/>
					</FormField>

					<div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
						<Button
							variant="ghost"
							onClick={() => setEditingCost(null)}
							className="!w-auto"
						>
							Cancelar
						</Button>
						<Button
							onClick={() => updateCostMutation.mutate()}
							disabled={updateCostMutation.isPending}
							className="!w-auto"
						>
							{updateCostMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
