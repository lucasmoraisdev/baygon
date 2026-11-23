# Documentação de Referência: Transição Multi-Tenant SaaS

Este diretório centraliza os documentos de referência técnica para a evolução da plataforma de gestão esportiva Baygon para um **SaaS Multi-Tenant B2B Modular**, com provisionamento automático de subdomínios e isolamento de segurança em múltiplas camadas.

Cada fase possui um documento dedicado detalhando:
- **Objetivo & Escopo da Fase**
- **Arquitetura Técnica & Código de Referência**
- **🎯 Metas Objetivas**
- **🧪 Métodos de Validação (Comandos e Critérios de Aceite)**
- **📚 Aprendizados Registrados**
- **💡 Sugestões de Melhorias Não Previstas**

---

## 🗺️ Mapa de Execução das Fases

| Documento de Referência | Título da Fase | Foco Principal | Status |
| :--- | :--- | :--- | :--- |
| [**references_01**](./references_01_fundacao_multi_tenant_backend.md) | **Fundação Multi-Tenant & Isolamento de Dados** | Modelos `Tenant`/`Plan`/`TenantModule`, `TenantMixin`, Migration Alembic e Interceptor SQLAlchemy | **CONCLUÍDA ✅** |
| [**references_02**](./references_02_motor_modulos_planos_guards_backend.md) | **Motor de Módulos, Planos & Guards no Backend** | Middleware de resolução de subdomínio, `@require_module` e endpoint `/tenant/me` | **CONCLUÍDA ✅** |
| [**references_03**](./references_03_roteamento_subdominios_frontend_modular.md) | **Roteamento de Subdomínios & Frontend Modular** | Next.js Edge Middleware, Theming White-Label e distinção de persona (Sócio vs Admin) | **CONCLUÍDA ✅** |
| [**references_04**](./references_04_faturamento_checkout_provisionamento_automatico.md) | **Faturamento & Provisionamento Automático (Zero-Touch)** | Checkout de planos modulares, webhooks com HMAC e worker de provisionamento de subdomínios | **CONCLUÍDA ✅** |
| [**references_05**](./references_05_testes_penetracao_isolamento_golive.md) | **Testes de Penetração, Isolamento & Go-Live** | Red Team simulation, Rate Limiting Redis, isolamento de Storage e SSL Wildcard | **CONCLUÍDA ✅** |
| [**references_06**](./references_06_formatos_avancados_torneios_campeonatos.md) | **Formatos Avançados de Torneios & Campeonatos** | Pontos corridos com times fixos, mata-mata (playoffs), grupos e chaveamentos | **CONCLUÍDA ✅** |

---

## 🛡️ Pilares de Segurança Inegociáveis da Plataforma
1. **Nenhum vazamento de dados entre ligas**: Interceptores de ORM e RLS impedem que qualquer query acesse dados fora do contexto do tenant ativo.
2. **Tokens JWT com Tenant Binding**: Um token da Associação A é sumariamente rejeitado se apresentado no subdomínio da Associação B.
3. **Experiência Limpa de Usuário**: Atletas e sócios comuns não são incomodados com avisos de compra de módulos; upsells são exibidos exclusivamente para o Presidente/Administrador da Liga.
