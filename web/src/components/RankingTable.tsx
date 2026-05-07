"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

export interface RankingEntry {
  id_player_score: number;
  player_id: number;
  points: number;
}

const BADGE_COLORS: Record<number, string> = {
  0: "bg-yellow-400 text-slate-900",
  1: "bg-slate-400 text-slate-900",
  2: "bg-amber-700 text-white",
};

const columnHelper = createColumnHelper<RankingEntry>();

const columns = [
  columnHelper.display({
    id: "position",
    header: "Posição",
    cell: ({ row }) => {
      const color = BADGE_COLORS[row.index] ?? "bg-muted text-background";
      return (
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${color}`}
        >
          #{row.index + 1}
        </span>
      );
    },
  }),
  columnHelper.accessor("player_id", {
    header: "Jogador",
    cell: (info) => `Jogador #${info.getValue()}`,
  }),
  columnHelper.accessor("points", {
    header: "Pontos",
    cell: (info) => (
      <span className="font-bold text-primary">{info.getValue()} pts</span>
    ),
  }),
];

interface RankingTableProps {
  data: RankingEntry[];
}

export function RankingTable({ data }: RankingTableProps) {
  const table = useReactTable({
    data: data.slice(0, 10),
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-muted">
        Nenhum dado na tabela de classificação ainda.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg">
      {table.getHeaderGroups().map((headerGroup) => (
        <div
          key={headerGroup.id}
          className="grid grid-cols-[80px_1fr_100px] px-4 py-3 text-xs font-semibold uppercase text-muted border-b border-white/5"
        >
          {headerGroup.headers.map((header) => (
            <span key={header.id}>
              {flexRender(header.column.columnDef.header, header.getContext())}
            </span>
          ))}
        </div>
      ))}

      <div className="flex flex-col gap-1 mt-1">
        {table.getRowModel().rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[80px_1fr_100px] items-center px-4 py-4 rounded-lg bg-black/20 border-l-[3px] border-l-transparent transition-all duration-200 hover:bg-primary/10 hover:translate-x-1 hover:border-l-primary"
          >
            {row.getVisibleCells().map((cell) => (
              <div key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
