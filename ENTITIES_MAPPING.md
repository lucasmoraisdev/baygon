# Relação de Entidades dos Repositórios

## 📊 Mapeamento de Repositórios → Entidades

### 1. **AwardRepository**
- **Entidades:** `Awards`
- **Modelos Relacionados:** `Award`, `AwardsPlayers`, `AwardsTeams`
- **Funcionalidades:**
  - Criar prêmio
  - Buscar prêmio por ID
  - Listar prêmios por rodada
  - Listar prêmios por time

---

### 2. **EventScoreRuleRepository**
- **Entidades:** `EventScoreRule`
- **Modelos Relacionados:** `EventScoreRule`
- **Funcionalidades:**
  - Criar regra de pontuação de evento
  - Buscar regra por ID

---

### 3. **MatchEventRepository**
- **Entidades:** `MatchEvent`
- **Modelos Relacionados:** `MatchEvent`
- **Funcionalidades:**
  - Adicionar eventos a uma partida
  - Listar eventos de uma partida

---

### 4. **MatchRepository**
- **Entidades:** `Match`, `MatchEvent`
- **Modelos Relacionados:** `Match`, `MatchEvent`
- **Funcionalidades:**
  - Criar partida
  - Buscar partida por ID
  - Buscar partidas por rodada
  - Buscar partidas por temporada

---

### 5. **PlayerRepository**
- **Entidades:** `Player`
- **Modelos Relacionados:** `Player`, `TeamPlayer`
- **Funcionalidades:**
  - Criar jogador
  - Listar todos os jogadores
  - Buscar jogador por ID
  - Atualizar jogador

---

### 6. **PlayerScoreRepository**
- **Entidades:** `PlayerScore`
- **Modelos Relacionados:** `PlayerScore`
- **Funcionalidades:**
  - Criar score do jogador
  - Listar todos os scores
  - Buscar score por ID

---

### 7. **PlayerSeasonScoreRepository**
- **Entidades:** `PlayerSeasonScore`
- **Modelos Relacionados:** `PlayerSeasonScore`
- **Funcionalidades:**
  - Gerenciar scores dos jogadores por temporada

---

### 8. **RoundRepository**
- **Entidades:** `Round`
- **Modelos Relacionados:** `Round`
- **Funcionalidades:**
  - Criar rodada
  - Buscar rodada por ID

---

### 9. **SeasonRepository**
- **Entidades:** `Seasons`
- **Modelos Relacionados:** `Seasons`
- **Funcionalidades:**
  - Criar temporada
  - Buscar temporada por ID
  - Editar temporada
  - Deletar temporada

---

### 10. **TeamRepository**
- **Entidades:** `Teams`
- **Modelos Relacionados:** `Teams`, `TeamPlayer`
- **Funcionalidades:**
  - Buscar time por ID
  - Listar times por rodada
  - Criar time
  - Atualizar time

---

### 11. **UserRepository**
- **Entidades:** `User`
- **Modelos Relacionados:** `User`
- **Funcionalidades:**
  - Buscar usuário por username
  - Buscar usuário por identifier (email, telefone, username)
  - Buscar usuário por email
  - Validar existência de dados do usuário

---

## 📚 Resumo de Entidades

| Entidade | Repositório | Descrição |
|----------|------------|-----------|
| `Award` | AwardRepository | Prêmios de rodadas/times |
| `EventScoreRule` | EventScoreRuleRepository | Regras de pontuação de eventos |
| `Match` | MatchRepository | Partidas/Jogos |
| `MatchEvent` | MatchEventRepository | Eventos que ocorrem em partidas |
| `Player` | PlayerRepository | Jogadores |
| `PlayerScore` | PlayerScoreRepository | Pontuação individual de jogadores |
| `PlayerSeasonScore` | PlayerSeasonScoreRepository | Pontuação de jogadores por temporada |
| `Round` | RoundRepository | Rodadas/Jornadas |
| `Season` | SeasonRepository | Temporadas/Campeonatos |
| `Team` | TeamRepository | Times |
| `User` | UserRepository | Usuários do sistema |

---

## 🔗 Relacionamentos Principais

```
User
  ├── Team
  │   ├── TeamPlayer
  │   │   └── Player
  │   ├── Round
  │   │   ├── Match
  │   │   │   └── MatchEvent
  │   │   │       └── EventScoreRule
  │   │   └── Award
  │   │       ├── AwardPlayers
  │   │       └── AwardTeams
  │   └── Season
  │       ├── Round
  │       └── PlayerSeasonScore
  └── Player
      ├── PlayerScore
      └── PlayerSeasonScore
```

---

## 📋 Entidades por Tipo

### Core Entities
- `Season` - Temporada/Campeonato
- `Round` - Rodada/Jornada
- `Match` - Partida
- `Team` - Time

### Human Entities
- `User` - Usuário
- `Player` - Jogador

### Association Entities
- `TeamPlayer` - Associação Jogador-Time
- `AwardsPlayers` - Associação Prêmio-Jogador
- `AwardsTeams` - Associação Prêmio-Time

### Score Entities
- `PlayerScore` - Score individual por partida
- `PlayerSeasonScore` - Score agregado por temporada

### Business Rules
- `EventScoreRule` - Regras para calcular pontos
- `MatchEvent` - Eventos que ocorrem nas partidas
- `Award` - Prêmios para times/jogadores
