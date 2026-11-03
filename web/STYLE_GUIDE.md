# Guia de Identidade Visual & Design System — Baygon Web

Este documento estabelece as diretrizes oficiais de design, componentes de interface, paleta de cores e padrões de UX para o frontend (`web`) do projeto **Baygon**. Todas as futuras adições, telas e refatorações devem seguir este guia rigorosamente para manter a harmonia e consistência visual do sistema.

---

## 1. Princípios de Design

1. **Dark Modern Theme & Transparências:** A estética do Baygon baseia-se em superfícies escuras, com vidros e desfoques sutis (*glassmorphism* suave) e contraste nítido em azul elétrico (`#3b82f6`).
2. **Densidade de Informação Inteligente:** Evitar contornos vazios ou cartões que ocupem toda a largura da tela sem necessidade. Preferir grids responsivos (ex: 4 colunas em desktops), badges discretas e botões de ação compactos.
3. **Previsibilidade e Feedback Imediato:** Qualquer ação de mutação (criar, editar, excluir) deve contar com estados de carregamento (`isPending`), modais com confirmação e botões desabilitados durante o envio.
4. **Alinhamento e Hierarquia:** O título da página divide a primeira linha com o botão principal de criação alinhado à direita. Abaixo ficam barras de busca/filtros e depois os dados em cards ou tabelas.

---

## 2. Paleta de Cores e Tokens de Tema

As cores estão centralizadas em `web/src/app/global.css` e mapeadas no Tailwind CSS v4 via diretiva `@theme`.

### 2.1 Cores Base

| Nome do Token | Variável CSS | Hex / RGBA | Uso Principal |
| :--- | :--- | :--- | :--- |
| **`background`** | `--bg-color` | `#0f172a` (Slate 900) | Fundo geral da aplicação |
| **`surface`** | `--bg-surface` | `rgba(30, 41, 59, 0.7)` | Fundo de cartões, modais e containers |
| **`border`** | `--border-color` | `rgba(255, 255, 255, 0.1)` | Linhas de divisão, bordas de cards e inputs |
| **`border-hover`** | `--border-hover` | `rgba(255, 255, 255, 0.2)` | Estado de hover em containers e inputs |
| **`primary`** | `--primary-color` | `#3b82f6` (Blue 500) | Ações principais, destaques, botões ativos |
| **`primary-hover`**| `--primary-hover` | `#2563eb` (Blue 600) | Hover de botões primários |
| **`main`** | `--text-main` | `#f8fafc` (Slate 50) | Títulos, valores numéricos de destaque, labels |
| **`muted`** | `--text-muted` | `#94a3b8` (Slate 400) | Subtítulos, metadados, datas, placeholders |

### 2.2 Cores Semânticas / Status (Badges e Alertas)

| Status | Classes Tailwind | Visual | Uso |
| :--- | :--- | :--- | :--- |
| **Sucesso / Ativo** | `bg-emerald-500/15 text-emerald-400 border border-emerald-500/30` | Verde suave | Temporada ativa, partida em andamento |
| **Concluído / Neutro** | `bg-zinc-500/15 text-zinc-400 border border-zinc-500/30` | Cinza translúcido | Temporada encerrada, status inativo |
| **Atenção / Advertência** | `bg-yellow-500/15 text-yellow-400 border border-yellow-500/30` | Amarelo dourado | Cartão amarelo, observação, aviso |
| **Perigo / Erro** | `bg-red-500/15 text-red-400 border border-red-500/30` | Vermelho | Cartão vermelho, suspensão, exclusão |

---

## 3. Tipografia e Escala de Texto

A aplicação utiliza fonte sem serifa do sistema com excelente legibilidade em fundos escuros:

- **H1 (Título da Página):** `text-2xl sm:text-3xl font-bold text-main`
- **H2 (Subtítulo de Seção):** `text-lg sm:text-xl font-semibold text-main`
- **H3 (Títulos de Cartões):** `text-base font-semibold text-main`
- **Body / Normal:** `text-sm text-main` (interativo) ou `text-sm text-muted` (descritivo)
- **Metadados e Legendas:** `text-xs text-muted`
- **Badges / Tags:** `text-[11px] font-semibold uppercase tracking-wider`

---

## 4. Padrões de Layout e Componentes

### 4.1 Estrutura Padrão de uma Página de Dashboard

Toda tela dentro de `(dashboard)` deve seguir a ordem:
1. **Header da Página:** Título + Subtítulo à esquerda | Botão de ação (ex: `+ Novo ...`) à direita.
2. **Barra de Controle (Opcional):** Input de busca com ícone de lupa + Filtro de exibição / Paginação.
3. **Área de Conteúdo Principal:** Grid de cards (4 por linha) ou Tabela virtualizada.
4. **Paginação (quando aplicável):** Barra inferior com texto contador e setas de navegação.

```tsx
<div className="flex flex-col gap-6 animate-slide-down">
  {/* 1. Header */}
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-main">Título da Página</h1>
      <p className="text-xs sm:text-sm text-muted mt-0.5">Descrição curta da seção</p>
    </div>
    <Button onClick={openCreateModal} className="!w-auto flex items-center gap-1.5 px-3.5 py-2 text-sm">
      <Plus className="w-4 h-4" />
      <span>Novo Item</span>
    </Button>
  </div>

  {/* 2. Barra de Filtro */}
  <div className="flex items-center justify-between gap-3 bg-surface border border-border rounded-xl p-3 sm:px-4">
    {/* Busca + Seletor de limite */}
  </div>

  {/* 3. Grid de Conteúdo */}
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {/* Cards */}
  </div>
</div>
```

---

### 4.2 Botões (`Button`)

Os botões não devem ocupar 100% da linha por padrão em telas normais de dashboard (use `!w-auto` quando necessário).

- **Botão Primário de Ação:**
  ```tsx
  <Button className="!w-auto flex items-center gap-1.5 px-3.5 py-2 text-sm">
    <Plus className="w-4 h-4" />
    <span>Criar Novo</span>
  </Button>
  ```
- **Botão Fantasma / Cancelar:**
  ```tsx
  <Button variant="ghost" onClick={handleClose}>
    Cancelar
  </Button>
  ```
- **Botão de Perigo / Exclusão:**
  ```tsx
  <Button variant="danger" onClick={handleDelete}>
    Excluir
  </Button>
  ```

---

### 4.3 Cards de Entidades (Grid de 4 por linha)

Para entidades como **Temporadas**, **Times**, **Rodadas** ou **Prêmios**, evitar containers esticados. Utilizar o padrão compacto:

- Borda sutil com efeito no hover: `border border-border hover:border-primary transition-all duration-200`
- Arredondamento consistente: `rounded-xl`
- Padding compacto: `p-4`
- Tag de status no canto superior direito
- Rodapé com indicador de detalhes (`→`)

```tsx
<Link
  href={`/seasons/${item.id}`}
  className="group bg-surface border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary hover:shadow-md transition-all duration-200 cursor-pointer"
>
  <div>
    <div className="flex items-center justify-between gap-2 mb-3">
      <span className="font-bold text-base text-main group-hover:text-primary transition-colors">
        Temporada #{item.number}
      </span>
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        Ativa
      </span>
    </div>
    <div className="text-xs text-muted flex items-center gap-1.5">
      <Calendar className="w-3.5 h-3.5" />
      <span>Início: {formatDate(item.initial_date)}</span>
    </div>
  </div>
  <div className="mt-4 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs text-muted group-hover:text-primary font-medium">
    <span>Ver detalhes</span>
    <span>&rarr;</span>
  </div>
</Link>
```

---

### 4.4 Inputs e Campos de Formulário

- Fundo escuro que contrasta com a superfície: `bg-background`
- Borda delicada: `border border-border focus:border-primary`
- Cantos arredondados: `rounded-lg`
- Padding interno equilibrado: `px-3 py-2 text-sm`

---

## 5. Ícones (Lucide React)

Sempre utilizar a biblioteca `lucide-react`. Padrões de tamanho:
- Em botões e badges: `w-4 h-4`
- Em metadados / legendas dentro de cards: `w-3.5 h-3.5`
- Ícones de busca / input: `w-4 h-4 text-muted`

---

## 6. Checklist para Futuras Telas e Componentes

Antes de concluir qualquer tela nova ou ajuste de frontend:
- [ ] O botão de ação principal está compacto (`!w-auto`) com ícone do Lucide?
- [ ] Os cards estão organizados em grid responsivo (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`)?
- [ ] Foi adicionada busca/filtro e paginação configurável quando houver múltiplos registros?
- [ ] As tags de status seguem a convenção semântica de cores (verde para ativo, cinza para concluído, etc.)?
- [ ] O componente trata os estados de `isLoading` (exibindo `<Loading />`) e `isError`?
- [ ] Não há textos ou dados em texto cru soltos sem tipografia semântica (`text-main` ou `text-muted`).

