export type FeeStatus = 'paid' | 'pending' | 'exempt';
export type CostStatus = 'paid' | 'pending';

export interface FeePlayer {
	id_player: number;
	nome: string;
	apelido?: string | null;
	is_associate: boolean;
	is_guest: boolean;
}

export interface MonthlyFee {
	id_fee: number;
	player_id: number;
	year: number;
	month: number;
	amount: number;
	status: FeeStatus;
	paid_at?: string | null;
	payment_method?: string | null;
	notes?: string | null;
	season_id?: number | null;
	player?: FeePlayer | null;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface FinancialCost {
	id_cost: number;
	description: string;
	category: string;
	amount: number;
	cost_date: string;
	status: CostStatus;
	paid_at?: string | null;
	payment_method?: string | null;
	notes?: string | null;
	season_id?: number | null;
	created_by_user_id?: number | null;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface FinancialSummaryPeriod {
	year: number;
	month: number;
	total_fees_paid: number;
	total_fees_pending: number;
	fees_count_paid: number;
	fees_count_pending: number;
	fees_count_exempt: number;
	total_costs_paid: number;
	total_costs_pending: number;
	period_balance: number;
}

export interface FinancialSummaryOverall {
	total_revenue: number;
	total_expenses: number;
	total_balance: number;
	total_pending_receivables: number;
}

export interface FinancialMonthlyTrendItem {
	year: number;
	month: number;
	label: string;
	revenue: number;
	costs: number;
	balance: number;
}

export interface FinancialSummary {
	period: FinancialSummaryPeriod;
	overall: FinancialSummaryOverall;
	trends: FinancialMonthlyTrendItem[];
}
