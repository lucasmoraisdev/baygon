# Casos de Uso - Sistema de Campeonatos

## 📋 Índice de Casos de Uso

1. [Gerenciamento de Usuários](#gerenciamento-de-usuários)
2. [Gerenciamento de Temporadas](#gerenciamento-de-temporadas)
3. [Gerenciamento de Rodadas](#gerenciamento-de-rodadas)
4. [Gerenciamento de Times](#gerenciamento-de-times)
5. [Gerenciamento de Jogadores](#gerenciamento-de-jogadores)
6. [Gerenciamento de Partidas](#gerenciamento-de-partidas)
7. [Gerenciamento de Eventos](#gerenciamento-de-eventos)
8. [Gerenciamento de Pontuação](#gerenciamento-de-pontuação)
9. [Gerenciamento de Prêmios](#gerenciamento-de-prêmios)
10. [Gerenciamento de Regras](#gerenciamento-de-regras)

---

## 🔐 Gerenciamento de Usuários

### UC001 - Autenticar Usuário
**Ator:** Usuário do Sistema  
**Objetivo:** Validar credenciais e acessar o sistema  
**Pré-condições:** Usuário possui conta registrada  
**Fluxo Principal:**
1. Usuário fornece username
2. Sistema busca usuário por username
3. Sistema validailidez das credenciais
4. Sistema retorna dados do usuário autenticado

**Pós-condições:** Usuário está autenticado na sessão  
**Exceções:**
- Usuário não encontrado → Retornar erro 404
- Usuário deletado → Retornar erro 403
- Credenciais inválidas → Retornar erro 401

---

### UC002 - Buscar Usuário por Email
**Ator:** Sistema/Administrador  
**Objetivo:** Recuperar informações de usuário pelo email  
**Pré-condições:** Email existente no banco de dados  
**Fluxo Principal:**
1. Sistema busca usuário por email
2. Sistema valida se usuário não foi deletado
3. Sistema retorna dados do usuário

**Pós-condições:** Informações do usuário recuperadas  
**Exceções:**
- Email não encontrado → Retornar null
- Usuário deletado → Retornar null

---

### UC003 - Buscar Usuário por Identificador
**Ator:** Sistema  
**Objetivo:** Localizar usuário por múltiplas formas de identificação  
**Pré-condições:** Nenhuma  
**Fluxo Principal:**
1. Sistema recebe identificador (email, telefone ou username)
2. Sistema busca usuário pelo identificador
3. Sistema valida se usuário não foi deletado
4. Sistema retorna dados do usuário

**Pós-condições:** Usuário identificado  
**Exceções:**
- Identificador não encontrado → Retornar null
- Usuário deletado → Retornar null

---

### UC004 - Validar Existência de Dados Única
**Ator:** Sistema  
**Objetivo:** Garantir unicidade de dados do usuário (username, email, telefone)  
**Pré-condições:** Nenhuma  
**Fluxo Principal:**
1. Sistema verifica se username já existe
2. Sistema verifica se telefone já existe
3. Sistema verifica se email já existe
4. Sistema retorna resultado de validação

**Pós-condições:** Validação realizada  
**Exceções:**
- Dados duplicados encontrados → Retornar true (dado já existe)

---

## 📅 Gerenciamento de Temporadas

### UC005 - Criar Temporada
**Ator:** Administrador do Sistema  
**Objetivo:** Criar uma nova temporada/campeonato  
**Pré-condições:** Usuário autenticado como administrador  
**Fluxo Principal:**
1. Administrador fornece dados da temporada
2. Sistema cria nova temporada
3. Sistema persiste dados no banco
4. Sistema retorna temporada criada

**Pós-condições:** Temporada criada com timestamp de criação  
**Exceções:**
- Dados inválidos → Retornar erro 400
- Falha na persistência → Retornar erro 500

---

### UC006 - Consultar Temporada por ID
**Ator:** Usuário do Sistema  
**Objetivo:** Recuperar informações de uma temporada específica  
**Pré-condições:** Temporada existe no banco  
**Fluxo Principal:**
1. Sistema busca temporada por ID
2. Sistema retorna dados da temporada

**Pós-condições:** Dados da temporada recuperados  
**Exceções:**
- Temporada não encontrada → Retornar null

---

### UC007 - Editar Temporada
**Ator:** Administrador do Sistema  
**Objetivo:** Modificar informações de uma temporada  
**Pré-condições:**
- Usuário autenticado como administrador
- Temporada existe no banco

**Fluxo Principal:**
1. Administrador fornece ID da temporada e novos dados
2. Sistema busca temporada
3. Sistema atualiza campos permitidos
4. Sistema persiste alterações
5. Sistema retorna temporada atualizada

**Pós-condições:** Temporada atualizada com novo timestamp  
**Exceções:**
- Temporada não encontrada → Retornar erro 404
- Dados inválidos → Retornar erro 400

---

### UC008 - Deletar Temporada
**Ator:** Administrador do Sistema  
**Objetivo:** Remover uma temporada  
**Pré-condições:**
- Usuário autenticado como administrador
- Temporada existe no banco

**Fluxo Principal:**
1. Administrador fornece ID da temporada
2. Sistema busca temporada
3. Sistema deleta temporada
4. Sistema retorna confirmação

**Pós-condições:** Temporada removida do banco  
**Exceções:**
- Temporada não encontrada → Retornar erro 404
- Temporada com dados associados → Retornar erro 409 (conflito)

---

## 🔄 Gerenciamento de Rodadas

### UC009 - Criar Rodada
**Ator:** Administrador do Sistema  
**Objetivo:** Criar uma nova rodada/jornada em uma temporada  
**Pré-condições:**
- Usuário autenticado como administrador
- Temporada existe

**Fluxo Principal:**
1. Administrador fornece dados da rodada
2. Sistema cria nova rodada
3. Sistema associa rodada à temporada
4. Sistema persiste dados

**Pós-condições:** Rodada criada e associada à temporada  
**Exceções:**
- Temporada não encontrada → Retornar erro 404
- Dados inválidos → Retornar erro 400

---

### UC010 - Consultar Rodada por ID
**Ator:** Usuário do Sistema  
**Objetivo:** Recuperar informações de uma rodada específica  
**Pré-condições:** Rodada existe no banco  
**Fluxo Principal:**
1. Sistema busca rodada por ID
2. Sistema retorna dados da rodada

**Pós-condições:** Dados da rodada recuperados  
**Exceções:**
- Rodada não encontrada → Retornar null

---

## 🏆 Gerenciamento de Times

### UC011 - Criar Time
**Ator:** Administrador do Sistema  
**Objetivo:** Registrar um novo time no sistema  
**Pré-condições:** Usuário autenticado como administrador  
**Fluxo Principal:**
1. Administrador fornece dados do time
2. Sistema cria novo time
3. Sistema persiste dados
4. Sistema retorna time criado

**Pós-condições:** Time criado e associável a rodadas  
**Exceções:**
- Dados inválidos → Retornar erro 400
- Email/Nome duplicado → Retornar erro 409

---

### UC012 - Consultar Time por ID
**Ator:** Usuário do Sistema  
**Objetivo:** Recuperar informações de um time específico  
**Pré-condições:** Time existe no banco  
**Fluxo Principal:**
1. Sistema busca time por ID
2. Sistema retorna dados do time

**Pós-condições:** Dados do time recuperados  
**Exceções:**
- Time não encontrado → Retornar null

---

### UC013 - Listar Times por Rodada
**Ator:** Usuário do Sistema  
**Objetivo:** Visualizar todos os times que participam de uma rodada  
**Pré-condições:** Rodada existe no banco  
**Fluxo Principal:**
1. Sistema busca todos os times da rodada
2. Sistema retorna lista de times

**Pós-condições:** Lista de times recuperada  
**Exceções:**
- Rodada não encontrada → Retornar lista vazia

---

### UC014 - Atualizar Time
**Ator:** Administrador do Sistema  
**Objetivo:** Modificar informações de um time  
**Pré-condições:**
- Usuário autenticado como administrador
- Time existe no banco

**Fluxo Principal:**
1. Administrador fornece ID do time e novos dados
2. Sistema busca time
3. Sistema atualiza campos permitidos
4. Sistema persiste alterações

**Pós-condições:** Time atualizado  
**Exceções:**
- Time não encontrado → Retornar erro 404
- Dados inválidos → Retornar erro 400

---

## 👥 Gerenciamento de Jogadores

### UC015 - Criar Jogador
**Ator:** Administrador do Sistema  
**Objetivo:** Registrar um novo jogador no sistema  
**Pré-condições:** Usuário autenticado como administrador  
**Fluxo Principal:**
1. Administrador fornece dados do jogador
2. Sistema cria novo jogador
3. Sistema persiste dados
4. Sistema retorna jogador criado

**Pós-condições:** Jogador criado e associável a times  
**Exceções:**
- Dados inválidos → Retornar erro 400
- Email duplicado → Retornar erro 409

---

### UC016 - Listar Todos os Jogadores
**Ator:** Usuário do Sistema  
**Objetivo:** Visualizar todos os jogadores cadastrados  
**Pré-condições:** Nenhuma  
**Fluxo Principal:**
1. Sistema busca todos os jogadores
2. Sistema retorna lista de jogadores

**Pós-condições:** Lista de jogadores recuperada  
**Exceções:**
- Nenhum jogador cadastrado → Retornar lista vazia

---

### UC017 - Consultar Jogador por ID
**Ator:** Usuário do Sistema  
**Objetivo:** Recuperar informações de um jogador específico  
**Pré-condições:** Jogador existe no banco  
**Fluxo Principal:**
1. Sistema busca jogador por ID
2. Sistema retorna dados do jogador

**Pós-condições:** Dados do jogador recuperados  
**Exceções:**
- Jogador não encontrado → Retornar null

---

### UC018 - Atualizar Jogador
**Ator:** Administrador do Sistema / Próprio Jogador  
**Objetivo:** Modificar informações de um jogador  
**Pré-condições:**
- Usuário autenticado
- Jogador existe no banco

**Fluxo Principal:**
1. Usuário fornece ID do jogador e novos dados
2. Sistema busca jogador
3. Sistema atualiza campos permitidos
4. Sistema persiste alterações
5. Sistema atualiza timestamp

**Pós-condições:** Jogador atualizado com novo timestamp  
**Exceções:**
- Jogador não encontrado → Retornar erro 404
- Dados inválidos → Retornar erro 400

---

## ⚽ Gerenciamento de Partidas

### UC019 - Criar Partida
**Ator:** Administrador do Sistema  
**Objetivo:** Registrar uma nova partida/jogo  
**Pré-condições:**
- Usuário autenticado como administrador
- Rodada e times existem no banco

**Fluxo Principal:**
1. Administrador fornece dados da partida
2. Sistema cria nova partida
3. Sistema associa partida à rodada
4. Sistema persiste dados

**Pós-condições:** Partida criada e pronta para receber eventos  
**Exceções:**
- Rodada não encontrada → Retornar erro 404
- Dados inválidos → Retornar erro 400

---

### UC020 - Consultar Partida por ID
**Ator:** Usuário do Sistema  
**Objetivo:** Recuperar informações de uma partida específica  
**Pré-condições:** Partida existe no banco  
**Fluxo Principal:**
1. Sistema busca partida por ID
2. Sistema retorna dados da partida

**Pós-condições:** Dados da partida recuperados  
**Exceções:**
- Partida não encontrada → Retornar null

---

### UC021 - Listar Partidas por Rodada
**Ator:** Usuário do Sistema  
**Objetivo:** Visualizar todas as partidas de uma rodada  
**Pré-condições:** Rodada existe no banco  
**Fluxo Principal:**
1. Sistema busca todas as partidas da rodada
2. Sistema retorna lista de partidas

**Pós-condições:** Lista de partidas recuperada  
**Exceções:**
- Rodada não encontrada → Retornar lista vazia

---

### UC022 - Listar Partidas por Temporada
**Ator:** Usuário do Sistema  
**Objetivo:** Visualizar todas as partidas de uma temporada  
**Pré-condições:** Temporada existe no banco  
**Fluxo Principal:**
1. Sistema busca todas as partidas da temporada
2. Sistema retorna lista de partidas

**Pós-condições:** Lista de partidas recuperada  
**Exceções:**
- Temporada não encontrada → Retornar lista vazia

---

## 📊 Gerenciamento de Eventos

### UC023 - Registrar Evento de Partida
**Ator:** Administrador do Sistema  
**Objetivo:** Registrar um evento que ocorre durante uma partida  
**Pré-condições:**
- Usuário autenticado como administrador
- Partida existe no banco
- Tipo de evento é válido

**Fluxo Principal:**
1. Administrador fornece dados do evento
2. Sistema valida tipo do evento
3. Sistema cria novo evento
4. Sistema associa evento à partida
5. Sistema persiste dados

**Pós-condições:** Evento criado e associado à partida  
**Exceções:**
- Partida não encontrada → Retornar erro 404
- Tipo de evento inválido → Retornar erro 400

---

### UC024 - Listar Eventos de Partida
**Ator:** Usuário do Sistema  
**Objetivo:** Visualizar todos os eventos de uma partida  
**Pré-condições:** Partida existe no banco  
**Fluxo Principal:**
1. Sistema busca todos os eventos da partida
2. Sistema retorna lista de eventos

**Pós-condições:** Lista de eventos recuperada  
**Exceções:**
- Partida não encontrada → Retornar lista vazia
- Nenhum evento registrado → Retornar lista vazia

---

## 🎯 Gerenciamento de Pontuação

### UC025 - Registrar Score do Jogador
**Ator:** Sistema (automático) / Administrador  
**Objetivo:** Registrar a pontuação de um jogador em uma partida  
**Pré-condições:**
- Jogador existe no banco
- Partida existe no banco
- EventScoreRule aplicável existe

**Fluxo Principal:**
1. Sistema recebe evento da partida
2. Sistema busca regra de pontuação aplicável
3. Sistema calcula pontos
4. Sistema cria registro de PlayerScore
5. Sistema persiste dados

**Pós-condições:** Score registrado para o jogador  
**Exceções:**
- Jogador não encontrado → Retornar erro 404
- Partida não encontrada → Retornar erro 404
- Regra não encontrada → Retornar erro 500

---

### UC026 - Listar Scores do Jogador
**Ator:** Usuário do Sistema  
**Objetivo:** Visualizar todos os scores de um jogador  
**Pré-condições:** Nenhuma  
**Fluxo Principal:**
1. Sistema busca todos os scores de todos os jogadores
2. Sistema retorna lista de scores

**Pós-condições:** Lista de scores recuperada  
**Exceções:**
- Nenhum score registrado → Retornar lista vazia

---

### UC027 - Consultar Score de Jogador
**Ator:** Usuário do Sistema  
**Objetivo:** Recuperar um score específico  
**Pré-condições:** Score existe no banco  
**Fluxo Principal:**
1. Sistema busca score por ID
2. Sistema retorna dados do score

**Pós-condições:** Dados do score recuperados  
**Exceções:**
- Score não encontrado → Retornar null

---

### UC028 - Calcular Score Agregado por Temporada
**Ator:** Sistema (automático)  
**Objetivo:** Calcular pontuação total de um jogador em uma temporada  
**Pré-condições:**
- Jogador existe no banco
- Temporada existe no banco
- Scores individuais foram registrados

**Fluxo Principal:**
1. Sistema busca todos os scores do jogador na temporada
2. Sistema soma todos os scores
3. Sistema cria/atualiza registro de PlayerSeasonScore
4. Sistema persiste dados

**Pós-condições:** Score agregado calculado e persistido  
**Exceções:**
- Jogador não encontrado → Retornar erro 404
- Temporada não encontrada → Retornar erro 404

---

## 🏅 Gerenciamento de Prêmios

### UC029 - Criar Prêmio
**Ator:** Administrador do Sistema  
**Objetivo:** Criar um novo prêmio para uma rodada  
**Pré-condições:**
- Usuário autenticado como administrador
- Rodada existe no banco

**Fluxo Principal:**
1. Administrador fornece dados do prêmio
2. Sistema cria novo prêmio
3. Sistema associa prêmio à rodada
4. Sistema persiste dados

**Pós-condições:** Prêmio criado e associável a times/jogadores  
**Exceções:**
- Rodada não encontrada → Retornar erro 404
- Dados inválidos → Retornar erro 400

---

### UC030 - Consultar Prêmio por ID
**Ator:** Usuário do Sistema  
**Objetivo:** Recuperar informações de um prêmio específico  
**Pré-condições:** Prêmio existe no banco  
**Fluxo Principal:**
1. Sistema busca prêmio por ID
2. Sistema valida se não foi deletado
3. Sistema retorna dados do prêmio

**Pós-condições:** Dados do prêmio recuperados  
**Exceções:**
- Prêmio não encontrado → Retornar null
- Prêmio deletado → Retornar null

---

### UC031 - Listar Prêmios por Rodada
**Ator:** Usuário do Sistema  
**Objetivo:** Visualizar todos os prêmios de uma rodada  
**Pré-condições:** Rodada existe no banco  
**Fluxo Principal:**
1. Sistema busca todos os prêmios da rodada
2. Sistema valida se não foram deletados
3. Sistema retorna lista de prêmios

**Pós-condições:** Lista de prêmios recuperada  
**Exceções:**
- Rodada não encontrada → Retornar lista vazia

---

### UC032 - Listar Prêmios por Time
**Ator:** Usuário do Sistema  
**Objetivo:** Visualizar todos os prêmios ganhos por um time  
**Pré-condições:** Time existe no banco  
**Fluxo Principal:**
1. Sistema busca todos os prêmios associados ao time
2. Sistema valida se não foram deletados
3. Sistema retorna lista de prêmios

**Pós-condições:** Lista de prêmios do time recuperada  
**Exceções:**
- Time não encontrado → Retornar lista vazia

---

## ⚙️ Gerenciamento de Regras

### UC033 - Criar Regra de Pontuação
**Ator:** Administrador do Sistema  
**Objetivo:** Definir como um tipo de evento resulta em pontos  
**Pré-condições:** Usuário autenticado como administrador  
**Fluxo Principal:**
1. Administrador fornece dados da regra
2. Sistema cria nova regra de pontuação
3. Sistema persiste dados
4. Sistema retorna regra criada

**Pós-condições:** Regra criada e aplicável a eventos  
**Exceções:**
- Dados inválidos → Retornar erro 400
- Tipo de evento duplicado → Retornar erro 409

---

### UC034 - Consultar Regra por ID
**Ator:** Sistema / Usuário  
**Objetivo:** Recuperar uma regra de pontuação específica  
**Pré-condições:** Regra existe no banco  
**Fluxo Principal:**
1. Sistema busca regra por ID
2. Sistema retorna dados da regra

**Pós-condições:** Dados da regra recuperados  
**Exceções:**
- Regra não encontrada → Retornar null

---

## 🔄 Fluxos de Negócio Compostos

### Fluxo: Criar Campeonato Completo
**Objetivo:** Criar uma temporada com rodadas, times e partidas  
**Passos:**
1. UC005 - Criar Temporada
2. UC009 - Criar Rodada (N vezes)
3. UC011 - Criar Time (M vezes)
4. UC013 - Listar Times por Rodada
5. UC019 - Criar Partida (para cada rodada)

---

### Fluxo: Registrar Resultado de Partida
**Objetivo:** Registrar eventos, simular scoreupdate automaticamente  
**Passos:**
1. UC020 - Consultar Partida
2. UC023 - Registrar Evento de Partida (N vezes)
3. UC024 - Listar Eventos de Partida
4. UC025 - Registrar Score (automático para cada evento)
5. UC027 - Consultar Score

---

### Fluxo: Gerar Ranking
**Objetivo:** Visualizar ranking de jogadores em uma temporada  
**Passos:**
1. UC006 - Consultar Temporada
2. UC028 - Calcular Score Agregado (para cada jogador)
3. Ordenar por PlayerSeasonScore DESC
4. Retornar ranking formatado

---

## 📊 Matriz de Atores vs Casos de Uso

| Ator | Casos de Uso |
|------|-------------|
| **Usuário do Sistema** | UC001, UC002, UC003, UC006, UC010, UC012, UC013, UC016, UC017, UC020, UC021, UC022, UC024, UC026, UC027, UC030, UC031, UC032, UC034 |
| **Administrador** | UC005, UC007, UC008, UC009, UC011, UC014, UC015, UC018, UC019, UC023, UC025, UC029, UC033 |
| **Sistema (Automático)** | UC025, UC028 |

---

## 📈 Dependências entre Casos de Uso

```
UC005 (Criar Temporada)
├── UC009 (Criar Rodada)
│   ├── UC011 (Criar Time)
│   │   ├── UC012 (Consultar Time)
│   │   ├── UC014 (Atualizar Time)
│   │   └── UC013 (Listar Times por Rodada)
│   ├── UC019 (Criar Partida)
│   │   ├── UC020 (Consultar Partida)
│   │   ├── UC021 (Listar Partidas por Rodada)
│   │   ├── UC023 (Registrar Evento)
│   │   │   ├── UC024 (Listar Eventos)
│   │   │   └── UC025 (Registrar Score)
│   │   │       └── UC027 (Consultar Score)
│   │   └── UC022 (Listar Partidas por Temporada)
│   ├── UC029 (Criar Prêmio)
│   │   ├── UC030 (Consultar Prêmio)
│   │   ├── UC031 (Listar Prêmios por Rodada)
│   │   └── UC032 (Listar Prêmios por Time)
│   └── UC033 (Criar Regra de Pontuação)
│       └── UC034 (Consultar Regra)
├── UC015 (Criar Jogador)
│   ├── UC016 (Listar Jogadores)
│   ├── UC017 (Consultar Jogador)
│   ├── UC018 (Atualizar Jogador)
│   └── UC025 (Registrar Score)
│       └── UC028 (Calcular Score Agregado)
└── UC028 (Calcular Score Agregado)

UC001 (Autenticar Usuário)
├── (todos os casos de uso requerem usuário autenticado)
```
