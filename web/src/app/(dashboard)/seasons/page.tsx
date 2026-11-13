'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { Loading } from '@/components/Loading';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { FormField } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { DatePicker } from '@/components/DatePicker';
import { Plus, Search, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface Season {
  id_season: number;
  number: number;
  initial_date: string;
  end_date?: string | null;
  is_active: boolean;
}

export default function SeasonsPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  // Filtros e paginação
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState<number>(8);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const { data: seasons = [], isLoading, isError } = useQuery<Season[]>({
    queryKey: ['seasons'],
    queryFn: () => fetchAPI('/seasons/'),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetchAPI('/seasons/', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
      setIsCreating(false);
      setNewNumber('');
      setNewDate('');
      setNewEndDate('');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = { initial_date: new Date(newDate).toISOString() };
    if (newNumber) body.number = parseInt(newNumber, 10);
    if (newEndDate) body.end_date = new Date(newEndDate).toISOString();
    createMutation.mutate(body);
  };

  // Filtragem por número de temporada
  const filteredSeasons = useMemo(() => {
    return seasons.filter((s) => {
      if (!searchTerm.trim()) return true;
      return s.number.toString().includes(searchTerm.trim());
    });
  }, [seasons, searchTerm]);

  // Paginação
  const totalPages = Math.ceil(filteredSeasons.length / pageSize) || 1;
  const paginatedSeasons = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSeasons.slice(start, start + pageSize);
  }, [filteredSeasons, currentPage, pageSize]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  if (isLoading) return <Loading />;
  if (isError)
    return <div className="text-red-500 p-4">Erro ao carregar temporadas.</div>;

  return (
    <div className="flex flex-col gap-6 animate-slide-down">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-main">Temporadas</h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Gerencie todas as edições e campeonatos
          </p>
        </div>

        <Button
          onClick={() => setIsCreating(true)}
          className="!w-auto flex items-center gap-1.5 px-3.5 py-2 text-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Temporada</span>
        </Button>
      </div>

      {/* Barra de Filtro e Quantidade por Página */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface border border-border rounded-xl p-3 sm:px-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Buscar por número (ex: 11)..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-main placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs sm:text-sm text-muted">
          <span>Exibir:</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="bg-background border border-border rounded-lg px-2.5 py-1 text-sm text-main focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value={4}>4 por página</option>
            <option value={8}>8 por página</option>
            <option value={12}>12 por página</option>
          </select>
        </div>
      </div>

      {/* Grid de Temporadas (4 por linha em telas grandes) */}
      {paginatedSeasons.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          {searchTerm
            ? 'Nenhuma temporada encontrada com o número informado.'
            : 'Nenhuma temporada cadastrada. Clique em "Nova Temporada" para começar.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {paginatedSeasons.map((s) => (
            <Link
              key={s.id_season}
              href={`/seasons/${s.id_season}`}
              className="group relative bg-surface border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              <div>
                {/* Header do Card com Tag de Status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-bold text-base text-main group-hover:text-primary transition-colors">
                    Temporada #{s.number}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      s.is_active
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
                    }`}
                  >
                    {s.is_active ? 'Ativa' : 'Concluída'}
                  </span>
                </div>

                {/* Datas da Temporada */}
                <div className="flex flex-col gap-1.5 text-xs text-muted">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span>
                      Início: {new Date(s.initial_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {s.end_date && (
                    <div className="flex items-center gap-1.5 pl-5 text-[11px]">
                      <span>
                        Fim: {new Date(s.end_date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé discreto indicando navegação */}
              <div className="mt-4 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs text-muted group-hover:text-primary font-medium transition-colors">
                <span>Ver detalhes</span>
                <span className="text-sm">&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Paginação */}
      {filteredSeasons.length > pageSize && (
        <div className="flex items-center justify-between border-t border-border pt-4 px-1">
          <span className="text-xs text-muted">
            Mostrando{' '}
            <strong className="text-main">
              {Math.min((currentPage - 1) * pageSize + 1, filteredSeasons.length)}
            </strong>{' '}
            a{' '}
            <strong className="text-main">
              {Math.min(currentPage * pageSize, filteredSeasons.length)}
            </strong>{' '}
            de <strong className="text-main">{filteredSeasons.length}</strong> temporadas
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-border bg-surface text-main hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 text-xs font-medium text-main bg-surface border border-border rounded-lg">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-border bg-surface text-main hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Criar Temporada */}
      <Modal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="Criar Nova Temporada"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <FormField label="Número da Temporada">
            <Input
              type="number"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              min={1}
              placeholder="Opcional (automático se vazio)"
            />
          </FormField>
          <FormField label="Data Inicial">
            <DatePicker
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Data de Encerramento">
            <DatePicker
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
            />
          </FormField>
          <div className="flex gap-3 mt-3">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreating(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
