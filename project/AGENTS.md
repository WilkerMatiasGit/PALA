# Estrutura do Sistema — Gestão de Laboratórios (DLab)

Sistema de gestão de ocupação de laboratórios, submissão e aprovação de atividades (aulas, visitas, projetos, estágios), gestão de inventário por movimentações e relatórios de utilização.

> **Este documento descreve o ESTADO ACTUAL do sistema.** Funcionalidades ainda não
> implementadas estão marcadas com **[INCOMPLETO]** ou **[PLANEADO]**. O roteiro de
> implementação evolucionária está em `PLANO.md` (raiz do repositório). Ao implementar
> qualquer item, atualize este documento e o plano em simultâneo.

ÍNDICE
1. Requisitos Funcionais
2. Fluxos de Atividades
3. Front — React
4. Backend — Node.js
5. Estado de Implementação (resumo)

---

## 1. REQUISITOS FUNCIONAIS

Legenda de estado: ✅ implementado · 🟡 parcial · 🔴 não implementado · 📋 planeado (ver PLANO.md).

### 1. Gestão de Utilizadores e Autenticação
- **✅ RF01 – Login**: login via email + senha (argon2). Utilizadores seedados com `senha_hash` nulo têm a senha `12345678` hasheada no primeiro login.
- **✅ RF02 – Controlo de Acesso (RBAC)**: middleware `authRequired` + `rbac(...)` validam `utilizador.tipo` por rota (Admin, Professor, Técnico, Coordenador DLab, Supervisor, Chefe de Departamento).
- 🟡 Registo público de contas **não existe** — utilizadores são criados pelo Admin.
- **✅ RF01b – Hardening básico**: `helmet` (headers de segurança) + `express-rate-limit` (global 300/15min; reforçado no `/user/login` 20/15min) + CORS whitelist (`localhost`, `*.vercel.app` e `CORS_ORIGINS` por env; pedidos sem Origin aceites) — ✅ **[E4]**. 🔴 **[INCOMPLETO]** Refresh tokens com revogação + logout real no servidor: só existe JWT de acesso (12h) + logout no cliente.
- 🔴 **[INCOMPLETO]** Validação zod partilhada: **não implementada** (validação manual por rota).

### 2. Submissão de Propostas (Aulas, Visitas, Projetos e Estágios)
- **✅ RF03 – Criação de Atividade**: `POST /actividades` (ou `/actividades/full` atómico com detalhes+agendamentos+materiais).
- **✅ RF04 – Proposta de Calendário**: múltiplos blocos de data/hora no mesmo formulário.
- **✅ RF05 – Detalhes de Aula**: exige `curso_disciplina_id`; recolhe `tema`, `turno` (manha/tarde), `numero_turma`; `num_participantes` e `precisa_assistente` na atividade.
- ✅ RF06 – Detalhes de Projeto/Estágio: exige `responsavel` professor, datas macro. **🟡** `anexo_path` é submetido como texto/URL (`PUT /projectos/:id/documento` | `PUT /estagios/:id/documento`); upload real com multer 🔴 **[INCOMPLETO]**.
- **✅ RF07 – Vínculo de Aluno** (estágio): `estudante_id`.
- **✅ RF08 – Detalhes de Visita**: `nome_visitante`, `instituicao`, `telefone`, `email`.

### 3. Fluxo de Aprovação (modelo POR AGENDAMENTO + conclusão de etapa)
> O projecto evoluiu do modelo original do AGENTS.md (voto por atividade) para **votos individuais por agendamento**
> com marcadores de etapa na atividade. Ver modelagem em §4.2 (`AgendamentoEstado`, `ActividadeEstado`).

- **✅ RF09 – Validação do DLab**: Coordenador DLab (ou Admin) vota em cada agendamento `nao_revisto` da atividade `pendente` → `agendamento.estado` passa a `aprovado_dlab` / `rejeitado`; pode também "Deixar pendente" (`POST /aprovacoes/pendente`) ou reverter (`POST /aprovacoes/rollback`). Conclusão da etapa: `POST /aprovacoes/:id/finalizar` → atividade `pendente → revisado_dlab` (com comentário obrigatório).
- **✅ RF10 – Validação do Supervisor**: Supervisor (ou Admin) vota nos agendamentos `aprovado_dlab`/`pendente` de atividades `revisado_dlab` → `aprovado_supervisor`/`rejeitado`. Conclusão final exige atribuição de Técnico validador (`actividade_tecnico`) e muda atividade `revisado_dlab → revisado_supervisor`.
- **✅ RF11 – Rejeição**: rejeição individual de agendamento ou rejeição total da atividade (`POST /aprovacoes/:id/rejeitar`), com justificação obrigatória; se TODOS os agendamentos forem rejeitados, `finalizar` rejeita a atividade no ato.
- ✅ **[E0]** "Pendentes não bloqueiam avanço": `finalizar` já não exige que todos os agendamentos estejam decididos (duas etapas activas: aprovados avançam, pendentes aguardam) — validado em smoke test.
- 📋 **[PLANEADO]** Votação em massa **no front** (backend `POST /aprovacoes/lote` ✅ E0) + histórico agrupado por lote no front — PLANO.md §2.5 e §2.6.
- 📋 **[PLANEADO]** Votação em massa (decidir vários agendamentos de uma vez) + histórico agrupado por lote — PLANO.md §2.5 e §2.6.
- 📋 **[PLANEADO]** Fluxo de aprovação configurável (cargos + ordem, aprovação mais antiga primeiro) — §3 do PLANO.md. Atualmente DLab→Supervisor está **hardcoded** no backend.
- 🔴 **[INCOMPLETO]** Comentário/parecer no voto individual é opcional; só obrigatório em conclusão/rejeição.

### 4. Calendário e Ocupação do Laboratório
- **✅ RF12 – Visualização do Calendário**: `GET /calendario` e `GET /agendamentos` listam **apenas agendamentos com `estado = aprovado_supervisor`**. Front: visões **mensal/semanal/diária** (✅ E2).
- **✅ RF13 – Bloqueio de Choques**: `POST /agendamentos` e o validador de `/actividades/full` rejeitam sobreposição no mesmo laboratório contra agendamentos `aprovado_supervisor` (409).
- **✅ RF14 – Confirmação de Presença**: `PUT /agendamentos/:id/confirmar-professor` (professor responsável) → `confirmado_professor_em`; depois `PUT /agendamentos/:id/confirmar-tecnico` (técnico validador) → quando ambos preenchidos, `realizado = true` **e baixa automática do stock** pedido (`historico_materiais`, motivo `consumo_actividade`) num `$transaction`.
  - 🔴 **[INCOMPLETO]** Notificação ao técnico (socket/e-mail) quando o professor confirma.
  - 🔴 **[INCOMPLETO]** Código de confirmação de presença (nanoid).

### 5. Gestão de Inventário (Materiais)
- **✅ RF15 – Inventário por Laboratório**: nome, categoria, quantidade (= SUM do histórico), unidade, estado, alerta de stock mínimo.
  - **✅ ** `UnidadeLaboratorial` (tipo de lab), `CategoriaMaterial` e `Unidade` (catálogo global) são **tabelas CRUD** desde o E0 (backend) — ver §4.2/§4.5; front ✅ **[E1]** via `SearchSelect` + `catalogoLabel` (PLANO.md §2.1).
- **✅ RF16 – Registo de Movimentação (Histórico)**: `historico_materiais` com `utilizador_id`, `quantidade_movimentada` (+/−), `motivo` (enum), `descricao` obrigatória, `actividade_id` opcional.
- **✅ RF17 – Bloqueio de Edição Direta**: `materiais.quantidade` é cache denormalizado do `SUM(historico_materiais.quantidade_movimentada)` (util `utils/stock.js`); nunca editado diretamente; stock inicial entra como 1ª movimentação (`compra_stock`).
- 🟡 **RF18 – Alerta de Stock Mínimo**: badge visual (`StockAlertBadge`) quando `quantidade <= quantidade_minima`; as notificações do `NotificacoesContext` usam **dados mock** — 🔴 **[INCOMPLETO]** alertas reais via socket.io (não implementado) e checagem por cron.

### 6. Relatórios Dinâmicos
- **✅ RF19 – Geração de Relatório Mensal**: `POST /relatorios` (Admin/Técnico) conta agendamentos `realizado: true` do mês/lab e guarda `dados_json`. Exportação: **🟡** PDF mínimo construído à mão (`/relatorios/:id/pdf`); 🔴 **[INCOMPLETO]** pdfkit.
- 🔴 **[INCOMPLETO]** Relatório automático mensal (node-cron) — não implementado.

### Nota sobre Técnico vs Assistente (mantida)
- Toda atividade precisa de um Técnico (**validador**) — confirma em 2º lugar a conclusão (RF14).
- Nem toda atividade precisa de Assistente — pessoa extra indicada quando `actividades.precisa_assistente = true`.
- Ambos ligados por `actividade_tecnico` (`tecnico_tipo`: `validador | assistente`), com `@@unique([actividade_id, papel])`.
- A atribuição acontece na conclusão da aprovação do Supervisor.

---

## 2. FLUXOS DE ATIVIDADES

- **Passo 1 — Registo e Perfis**: utilizadores criados pelo Admin (`POST /user`); cada utilizador edita o próprio perfil em `/perfil` (nome e senha; email/tipo só visíveis). ✅ Desde o E0: perfil não-admin usa `GET /user/me` e a troca de senha exige **senha actual** (`senha_actual`).
- **Passo 2 — Infraestrutura e Recursos**: CRUDs de laboratórios, cursos, disciplinas, curso-disciplinas, estudantes, materiais (stock inicial = 1ª movimentação).
- **Passo 3 — Submissão da Proposta**: formulário único (`ActividadeUpsertModal` multistep: Dados Base → Detalhes → Agendamentos → Materiais).
- **Passo 4 — Validação**: votos por agendamento no DLab e, depois, no Supervisor (`/aprovacoes/:id`, ou em massa via `POST /lote`); conclusão de etapa com parecer obrigatório; atribuição de técnico/assistente na etapa final. Etapas configuráveis (`/configuracao/fluxo`).
- **Passo 5 — Impacto no Calendário e Baixa de Materiais**: agendamentos `aprovado_supervisor` passam a aparecer no calendário; no dia, professor confirma, depois técnico → `realizado` + baixa automática de stock.
- **Passo 6 — Ajustes Manuais de Inventário**: `HistoricoMaterialUpsertModal` (entrada/saída, motivo, justificação; `actividade_id` em branco).
- **Passo 7 — Relatórios**: manual (`POST /relatorios`); automático 🔴 **[INCOMPLETO]**.

---

## 3. FRONT — REACT

Stack real: react + vite, tailwindcss, shadcn/ui (Radix), react-hook-form (🟡 pouco usado), react-router-dom, recharts, date-fns, sonner, lucide-react, socket.io-client 🔴 **[INCOMPLETO]** (não instalado/ligado), axios. **(E4)** Removidos por não uso: `zod`, `@tanstack/react-query`, `@tanstack/react-table`, `zustand`, `@supabase/supabase-js`, `@hookform/resolvers`.

Convenção de Roles — A = Admin · P = Professor · T = Técnico · C = Coordenador DLab · S = Supervisor · CD = Chefe de Departamento.

### 3.1. ESTRUTURA DE ARQUIVOS (ACTUAL)

```
src/
├── components/
│   ├── ui/                          # Biblioteca shadcn feita + componentes próprios:
│   │   ├── alert.tsx, badge.tsx, button.tsx, card.tsx, checkbox.tsx,
│   │   ├── command.tsx (cmdk), confirm-dialog.tsx, dialog.tsx,
│   │   ├── dropdown-menu.tsx, empty-state.tsx, error-state.tsx,
│   │   ├── filters-bar.tsx + SimplePagination (interface FilterField)
│   │   ├── input.tsx, label.tsx, pagination.tsx (não usado; usar simple-pagination),
│   │   ├── number-input.tsx (NumberInput + sanitizeNumber — ✅ E1),
│   │   ├── popover.tsx, search-select.tsx (SearchSelect + criar na hora — ✅ E1),
│   │   ├── select.tsx, skeleton.tsx, sonner.tsx, spinner.tsx,
│   │   ├── stock-alert-badge.tsx, switch.tsx, table.tsx, table-skeleton.tsx,
│   │   ├── tabs.tsx, textarea.tsx, tooltip.tsx e demais primitivas shadcn
│   ├── layout/   AppShell.tsx · Sidebar.tsx · Topbar.tsx · PageHeader.tsx · AuthLayout.tsx · ProtectedRoute.tsx
│   ├── modal/    ActividadeUpsertModal.tsx · CursoUpsertModal.tsx · DisciplinaUpsertModal.tsx
│   │             EstudanteUpsertModal.tsx · HistoricoMaterialUpsertModal.tsx
│   │             LaboratorioUpsertModal.tsx · MaterialUpsertModal.tsx
│   │             RelatorioUpsertModal.tsx · ResetPasswordModal.tsx (✅ E1) · UtilizadorUpsertModal.tsx
│   └── dashboard/ StatCard.tsx · ActividadesPendentesWidget.tsx · StockAlertsWidget.tsx · ProximasAulasWidget.tsx
├── pages/
│   ├── auth/         Login.tsx                 (/)
│   ├── dashboard/    Dashboard.tsx             (/inicio)
│   ├── utilizadores/ Perfil.tsx (/perfil) · UtilizadoresList.tsx (/users, A)
│   ├── laboratorios/ LaboratoriosList.tsx (/labs) · LaboratorioDetalhe.tsx (/labs/:id)
│   ├── cursos/       CursosList.tsx (/cursos) · CursoDetalhe.tsx (/cursos/:id)  # ✅ E2 associação disciplina-turma · DisciplinasList.tsx (/disciplinas)
│   ├── estudantes/   EstudantesList.tsx (/estudantes) · EstudanteDetalhe.tsx (/estudantes/:id)  # ✅ E2 tabs Geral/Actividades
│   ├── actividades/  ActividadesList.tsx (/actividades) · ActividadeDetalhe.tsx (/actividades/:id)  # ✅ E2 tabs
│   ├── aprovacoes/   AprovacoesList.tsx (/aprovacoes) · AprovacaoDetalhe.tsx (/aprovacoes/:id)      # ✅ E2 tabs + decisão em massa
│   ├── calendario/   Calendario.tsx (/calendario)      # ✅ E2 mensal/semanal/diário
│   ├── materiais/    MateriaisList.tsx (/materiais) · MateriaisHistoricoList.tsx (/materiais/historico) · MaterialDetalhe.tsx (/materiais/:id)
│   ├── relatorios/   RelatoriosList.tsx (/relatorios) · RelatorioDetalhe.tsx (/relatorios/:id)
│   └── configuracao/ Configuracao.tsx (/configuracao)  # ✅ E2 fluxo de aprovação + catálogos (A)
├── context/          AuthContext.tsx · NotificacoesContext.tsx (mock, sem socket)
├── hooks/            use-toast.ts (✅) — hooks de domínio (useAuth/useActividades/...) 🔴 [NÃO CRIADOS]
├── services/         api.ts · enums.ts · auth.service.ts · utilizadores.service.ts
│                     laboratorios.service.ts · cursos.service.ts · actividades.service.ts
│                     aprovacoes.service.ts · agendamentos.service.ts · materiais.service.ts
│                     movimentacoes.service.ts · relatorios.service.ts · catalogos.service.ts (✅ E1) ·
│                     configuracao.service.ts (✅ E2)
├── types/            *.types.ts espelhando os DTOs do backend (+ catalogo.types.ts ✅ E1 · configuracao.types.ts ✅ E2)
├── utils/            roleGuard.ts · formatDate.ts · formatEstado.ts · constants.ts · catalogo.ts (✅ E1, catalogoLabel)
└── router/           AppRouter.tsx
```

📋 **[PLANEADO]** — novos componentes/páginas (PLANO.md): tabs em `LaboratorioDetalhe`, visões semanal/diária no `Calendario` (✅ E2), e erros por campo em tempo-real nos modais.

### 3.2. PADRÕES DE TELA (resumo do comportamento actual)

- **Listagens**: `PageHeader` + `FiltersBar` + `Table` + `SimplePagination` (client-side, `PAGE_SIZE=10`). Com filtros+paginação: **Utilizadores, Estudantes, Actividades, Materiais, Histórico, Laboratórios, Cursos, Disciplinas, Aprovações, Relatórios** (✅ E1).
- **Detalhes**: telas em "cards" no grid (Laboratório, Material, Relatório) e em **tabs** (Atividade ✅ E2, Aprovação ✅ E2, Estudante ✅ E2). 📋 Tabs planeadas em Laboratório (PLANO.md §2.6).
- **Modais de CRUD**: `*UpsertModal` sobre `Dialog`. **ConfirmDialog** (AlertDialog) para acções destrutivas. ⚠ **Não usar `confirm()`/`alert()`/`prompt()` nativos** — `window.prompt` eliminado (E1, `ResetPasswordModal`); faltam confirmações de acções críticas (PLANO.md §2.3).
- **Calendário**: ✅ E2 — visões **mensal/semanal/diária** (tabs), todos os dias da semana/mês visíveis, badges por agendamento `aprovado_supervisor`, alerta de choque (mesmo lab/dia ou sobreposição na timeline), navegação ‹ › + botão "Hoje" + input `type=date`. Backend `GET /agendamentos` e `/calendario` aceitam `de`/`ate` (substituem `mes`/`ano`).
- **Validação de formulários**: 🟡 sobretudo no submit (`getStepError` por passo); erros por campo em tempo-real inexistentes; inputs numéricos agora via `NumberInput` (bloqueiam `-`/`.`/`e`/`+` — ✅ E1). 📋 erros por campo (PLANO.md §2.13).

### 3.3. SERVICES

Cada service usa a instância `api` (axios, baseURL `/api`, interceptor JWT). Endpoints espelhados em §4.5.

- `auth.service.ts` → login, logout
- `utilizadores.service.ts` → list, listTecnicos, getMe, get, create, update, changePassword (senha_actual), resetPassword, remove
- `laboratorios.service.ts` → list, get, create, update, remove
- `cursos.service.ts` → cursos (list/get/create/update/remove) · disciplinas (list/create/update/remove) · curso-disciplinas (list, create, remove) · estudantes (list/get/create/update/remove)
- `actividades.service.ts` → list, get, create, update, remove, createFull, updateFull · aula/visita/projecto/estagio (get + upsert + submeterDocumento) · tecnicos (list/add/remove) · materiais (list/add/remove)
- `aprovacoes.service.ts` → listFila, get, listByActividade, create, createLote, finalizar, deixarPendente, rollback, rejeitarActividade
- `agendamentos.service.ts` → list (filtro lab/meses/de–ate, só aprovado_supervisor), listByActividade, create, update, confirmarProfessor, confirmarTecnico, remove
- `materiais.service.ts` → list, get, create, update, remove
- `movimentacoes.service.ts` → listAll, listByMaterial, create
- `relatorios.service.ts` → list, get, create, exportarPdf
- `catalogos.service.ts` (✅ E1) → unidadesLaboratoriaisService · categoriasMaterialService · unidadesService (list/create/update/remove)
- `configuracao.service.ts` (✅ E2) → getFluxo · updateFluxo · resetFluxo (fluxo de aprovação)

---

## 4. BACKEND — NODE.JS

Stack real: **Express 5 + Prisma ORM v7 (`@prisma/adapter-pg`) + Postgres** (dev; staging **Neon** via pooled connection string — ✅ **[E3]** ligado). Autenticação JWT (jsonwebtoken) + argon2. **`helmet` + `express-rate-limit` + CORS whitelist (**✅ **[E4]**)`. Sem camada zod, sem socket.io, sem cron, sem nodemailer, sem multer, sem pdfkit (PDF mínimo à mão). Nota: o build de produção não transpila o servidor — corre com `node` (ESM). **✅ **[E3]** Exportado como Vercel Function** (`api/index.js` + `vercel.json`) — deploy feito em https://dlab-gray.vercel.app (SPA + API sob `/api`).

> ⚠ Backend deps em `server/package.json` (workspace npm) e instaladas via raiz. Scripts: `dev` (server+vite juntos) · `dev:server` · `dev:web` · `deploy` (migrate deploy + prisma generate + `vercel deploy --prod`, exige `VERCEL_TOKEN` no `.env`) · `db:generate` · `db:push` · `db:setup` · `db:migrate` · `migrate:deploy` · `vercel-build`. O `seed-db.js` insere IDs explícitos e, no fim, **sincroniza as sequences** com os `MAX(id)` (via `server/scripts/sync-sequences.js`) — evita "Unique constraint failed" no próximo INSERT.

### 4.1. ESTRUTURA DE ARQUIVOS (ACTUAL)

```
server/src/
├── index.js            # bootstrap: initDb → counts → listen
├── app.js              # express: cors, json, /health, /calendario (inline), routers, 404, erro
├── config.js           # PORT, JWT_SECRET, JWT_EXPIRES_IN
├── db.js               # PrismaClient + PrismaPg adapter + initDb()
├── middleware/auth.js  # authRequired + rbac(...)
├── modules/            # ROTEIROS (sem camada controller/service/schema):
│   ├── auth.routes.js            # POST /user/login
│   ├── utilizadores.routes.js    # /user/*
│   ├── cursos.routes.js          # /cursos/*
│   ├── academico.routes.js       # /disciplinas, /curso-disciplinas, /estudantes
│   ├── laboratorios.routes.js    # /labs/*
│   ├── materiais.routes.js       # /materiais/* (+ /historico)
│   ├── actividades.routes.js     # /actividades/* (+ /full)
│   ├── especializacoes.routes.js # aulas, visitas, projectos, estagios, atividade-tecnico, atividade-materiais
│   ├── agendamentos.routes.js    # /agendamentos/*
│   ├── aprovacoes.routes.js      # /aprovacoes/* (fila+decisão) e /actividades/:id/aprovacoes (histórico)
│   └── relatorios.routes.js      # /relatorios/*
├── utils/              # dto.js (mappers Prisma→DTO) · hash.js (argon2) · stock.js (RF17)
└── seed.js             # ⚠ LEGADO (mock JSON) — não usado em runtime

server/prisma/          # schema.prisma (provider postgresql — E3) + migrations/ ✅ [E3] com migração inicial (init) aplicada no Neon
server/scripts/seed-db.js
server/data/            # ⚠ db.json + .log (LEGADO, não consumido em runtime)

api/                    # ✅ [E3] Vercel Function: index.js (mount Express sob /api)
vercel.json             # ✅ [E3] buildCommand vercel-build, rewrites /api + SPA fallback
prisma.config.ts        # schema path, datasource url (+ directUrl Neon) — E3
```

📋 **[PLANEADO]** — introduzir módulos por domínio com zod schemas, jobs/ (relatorioMensal, stockMinimo), utils/pdf, mailer, socket, migrations versionadas — PLANO.md §2/§3/§4.

### 4.2. BD (ACTUAL — `server/prisma/schema.prisma`)

Convenções: BaseEntity em todas as tabelas (`id`, `criado_em`, `actualizado_em`, `activo` soft delete). `materiais.quantidade` é cache do SUM do histórico (RF17). Relações com `@@map` snake_case. **Provider `postgresql`** (✅ E3) — ✅ **[E3]** migração inicial versionada criada e aplicada no Neon; dev pode usar `prisma migrate dev`/`migrate:deploy` a partir de agora.

Enums actuais:
- `LaboratorioTipo { quimica, fisica, outro }` → ✅ **[E0]** substituído por tabela `unidades_laboratoriais`
- `DepartamentoTipo { DET, DCSA, GEO, outro }` (mantido como enum)
- `UtilizadorTipo { admin, professor, tecnico, coordenador_dlab, supervisor, chefe_departamento }` (mantido)
- `ActividadeTipo { aula, visita, projecto, estagio }` (mantido)
- `ActividadeEstado { pendente, revisado_dlab, revisado_supervisor, rejeitado }` ← modelo por agendamento
- `AgendamentoEstado { nao_revisto, pendente, aprovado_dlab, aprovado_supervisor, rejeitado }`
- `AprovacaoEtapa { dlab, supervisor }` · `AprovacaoDecisao { aprovado, rejeitado }` (📋 **[PLANEADO]** tornar dinâmicas via `FluxoAprovacao` — §3 PLANO.md; backend de configuração ✅ E0)
- `MaterialCategoria { equipamento, composto, vidraria, consumivel }` → ✅ **[E0]** substituído por tabela `categorias_material`
- `MaterialEstado { disponivel, em_uso, manutencao, esgotado }` (mantido)
- `MovimentacaoMotivo { consumo_actividade, quebra_acidente, compra_stock, ajuste_inventario, outro }` (mantido)
- `TecnicoTipo { validador, assistente }` (mantido)
- `TurnoTipo { manha, tarde }` (extra vs. spec original)

Tabelas (resumo): `utilizadores`, `cursos`, `estudantes` (id = matrícula), `disciplinas`, `curso_disciplinas` (`@@unique [curso_id, disciplina_id]`), `laboratorios` (**`unidade_laboratorial_id`**), `materiais` (**`categoria_id` + `unidade_id`**), `historico_materiais`, `actividades` (**`criado_por_id` + `responsavel_id`**), `actividade_tecnico` (`@@unique [actividade_id, papel]`), `actividade_materiais` (`@@unique [actividade_id, material_id]`), `aprovacoes` (**`agendamento_id` + `actividade_id`**), `aprovacao_agendamentos` (junção de decisão em lote — E0), `agendamentos` (`estado`, `confirmado_professor_em`, `confirmado_tecnico_em`, `realizado`), `aulas` (`tema`, `turno`, `numero_turma`), `visitas`, `projectos` (`anexo_path`), `estagios` (`anexo_path`), `relatorios` (`dados_json` LongText), `fluxo_aprovacao` (E0 — etapas configuráveis), `unidades_laboratoriais`/`categorias_material`/`unidades` (catálogos E0).

📋 **[PLANEADO — E2]** — tela de catálogos/reconfiguração em `Configuracao.tsx` (✅ E2). Backend ✅ E0: `unidades_laboratoriais`, `categorias_material`, `unidades` (CRUD via `SearchSelect`/`catalogos.service.ts`), `fluxo_aprovacao` (etapas configuráveis; gestão no front em E2 ✅) e `aprovacao_agendamentos` (decisão em lote com comentário único; front de decisão em massa ✅ E2).

### 4.3. MODELS
Espelham as tabelas acima. Relações relevantes: `actividades` 1:1 com a especialização; 1:N com `agendamentos`, `actividade_materiais`, `actividade_tecnico`, `aprovacoes`, `historico_materiais`; `materiais` 1:N `historico_materiais` (stock derivado); `aprovacoes.agendamento_id` opcional (decisões de etapa/rejeição global têm `agendamento_id = null`).

### 4.4. DTOS
Mappers em `utils/dto.js`. Notas de divergência face ao AGENTS.md original:
- `LoginResponse { user: {id,nome,email,tipo}, token }`.
- `ActividadeUpsert` usa `responsavel_id` (não `utilizador_id`); `ActividadeGet` inclui `criado_por_nome` e `responsavel_nome`.
- `AgendamentoGet` inclui `estado`.
- `AulaGet` inclui `tema`, `turno`, `numero_turma`, `turma` (derivada `CURSO{_M|T}{n}`).
- `AprovacaoGet` inclui `agendamento_id`.

### 4.5. ENDPOINTS (ACTUAL)

Autenticação:
- `POST /user/login` (público) → LoginResponse.

Utilizadores (`/user`, autenticado):
- `GET /user` (A) · `GET /user/tecnicos` (A,C,S,CD) · `GET /user/:id` (A) · `POST /user` (A; exige email `@isptec.co.ao`, senha default `12345678`) · `PUT /user/reset-password` (A) · `PUT /user/:id` (autenticado; não-admin só a si próprio; trocar senha exige `senha_actual`) · `DELETE /user/:id` (A, soft).
- ✅ **[E0 — §2.9/2.12]** `GET /user/me` (autenticado, qualquer role) → devolve o próprio utilizador.

Cursos (`/cursos`): `GET /` (todos) · `GET /:id` (todos) · `POST /` (A) · `PUT /:id` (A) · `DELETE /:id` (A).

Disciplinas (`/disciplinas`): `GET /` (todos) · `POST /` (A) · `PUT /:id` (A) · `DELETE /:id` (A). 🔴 Sem `GET /:id`.

Curso-Disciplinas (`/curso-disciplinas`): `GET /?curso_id=` (todos) · `POST /` (A) · `DELETE /:id` (A). 🔴 Sem `PUT /:id`.

Estudantes (`/estudantes`): `GET /` · `GET /:id` (todos) · `POST /` · `PUT /:id` · `DELETE /:id` (A,P,C,S,CD) · ✅ **[E0]** `GET /:id/actividades` (A,P,C,S,CD — vínculos de actividades do estudante).

Laboratórios (`/labs`): `GET /` (todos) · `GET /:id` (A,T,C,S,CD) · `POST /` (A) · `PUT /:id` (A) · `DELETE /:id` (A).

Materiais (`/materiais`): acesso base A,T,C,S,CD (P sem acesso) — `GET /` · `GET /:id` (quantidade = SUM histórico) · `POST /` (+ 1ª movimentação se `quantidade_inicial>0`) · `PUT /:id` (sem quantidade) · `DELETE /:id` · `GET /historico` · `GET /:id/historico` · `POST /historico` (A,T,S,CD).

Actividades (`/actividades`): acesso base A,P,C,S,CD (P vê só as suas; T só as que lhe foram atribuídas). `GET /` (filtros tipo/estado/lab) · `GET /:id` · `POST /` · `PUT /:id` · `POST /full` · `PUT /:id/full` (atómico: +detalhes +agendamentos +materiais; valida RF13 e stock) · `DELETE /:id` · `GET /:id/aula|visita|projecto|estagio|tecnicos|materiais|agendamentos`.

Especializações: `POST /aulas|visitas|projectos|estagios` (upsert por `actividade_id`) · `PUT /projectos/:id/documento` · `PUT /estagios/:id/documento` · `POST /actividade-tecnico` (A,C,S) · `DELETE /actividade-tecnico/:id` · `POST /actividade-materiais` · `DELETE /actividade-materiais/:id`.

Agendamentos (`/agendamentos`): `GET /?laboratorio_id=&mes=&ano=&de=&ate=` (todos; só `aprovado_supervisor`; `de`/`ate` substituem `mes`/`ano` quando presentes — ✅ E2) · `POST /` (A,P,C,S,CD; valida RF13) · `PUT /:id` (A,P,C,S,CD) · `DELETE /:id` (soft) · `PUT /:id/confirmar-professor` (P responsável, A) · `PUT /:id/confirmar-tecnico` (T validador, A) → `realizado` + baixa de stock.

Aprovações (`/aprovacoes`): acesso A,C,S,CD. `GET /` (fila config-driven via `FluxoAprovacao`: S vê `revisado_dlab`, resto `pendente`, A vê ambas) · `GET /:id` (id = atividade) · `POST /` (voto por agendamento: `{agendamento_id, etapa, decisao, comentario?}`) · **✅ [E0]** `POST /lote` (decisão em massa → `Aprovacao` + `aprovacao_agendamentos`, comentário único) · `POST /pendente` · `POST /rollback` (revoga votos de lote) · `POST /:id/finalizar` (`{comentario}` obrigatório; **✅ [E0] pendentes não bloqueiam avanço**) · `POST /:id/rejeitar` (`{comentario}` obrigatório). Histórico: `GET /actividades/:id/aprovacoes` (✅ [E0] agrupado por lote).

Calendário: `GET /calendario?laboratorio_id=&mes=&ano=&de=&ate=` (todos; só `aprovado_supervisor`; `de`/`ate` substituem `mes`/`ano` — ✅ E2).

Catálogos e Configuração (`/configuracao` + novos routers — E0, escrita só A): `GET/POST/PUT/DELETE /unidades-laboratoriais` · `GET/POST/PUT/DELETE /categorias-material` · `GET/POST/PUT/DELETE /unidades` (motor de catálogos em `utils/catalogos.js`) · `GET/PUT /configuracao/fluxo` (A,C,S) · `POST /configuracao/fluxo/reset` (A).

Relatórios (`/relatorios`): `GET /` · `GET /:id` · `POST /` (A,T) · `GET /:id/pdf` (PDF mínimo) — acesso R: A,T,C,S,CD.

---

## 5. ESTADO DE IMPLEMENTAÇÃO (resumo)

**Implementado:** CRUDs de utilizadores/cursos/disciplinas/curso-disciplinas/estudantes/laboratórios/materiais; actividades `/full`; approvação por agendamento + conclusão/rejeição de etapa; stock por movimentações (RF17) + alerta visual; confirmação em 2 passos com baixa automática de stock; relatórios manuais + PDF mínimo; RBAC por rota; JWT + argon2. **E0 (backend):** catálogos `unidades_laboratoriais`/`categorias_material`/`unidades` com CRUD; `fluxo_aprovacao` configurável; `POST /aprovacoes/lote` + histórico agrupado; pendentes-não-bloqueiam em `finalizar`; `GET /user/me` + `senha_actual` no perfil; `GET /estudantes/:id/actividades`; filtros `de`/`ate` em `/agendamentos` e `/calendario`. **E1 (front):** `SearchSelect` (pesquisa + criar na hora) nos modais de lab/material + displays via `catalogoLabel`; `NumberInput` em todos os modais; `ResetPasswordModal` (fim de `window.prompt`); `FiltersBar`+`SimplePagination` em todas as listagens. **E2 (front):** detalhe de Estudante (tabs Geral/Actividades) e Curso (associação disciplina-turma) + chevrons nas listas; calendário mensal/semanal/diário + "Hoje" (+ `de`/`ate` no backend); tabs + decisão em massa no detalhe de Aprovação; tabs no detalhe de Atividade + histórico agrupado por lote; Perfil só com alteração de senha (senha actual exigida); tela `/configuracao` (fluxo + catálogos). **E3 (liga ▲ deploy ✔):** provider `postgresql` + `@prisma/adapter-pg`; `db.js` com `PrismaPg`; Neon ligado (pooled URL) com migração `init` versionada aplicada + seed; `api/index.js` + `vercel.json` (função Vercel + SPA fallback + `vercel-build`); `migrate:deploy`; `prisma.config.ts` com `directUrl`; `server/package.json` com deps backend; `.env.example` Postgres. **Deploy feito** → https://dlab-gray.vercel.app (verificado: `/api/health`, login e SPA em produção). — falta só o CI (opcional). **E4 (hardening/auditoria ✔ — backend local; redeploy pendente):** `helmet` + `express-rate-limit` (global 300/15min + login 20/15min) + **CORS whitelist** por env `CORS_ORIGINS` (localhost, `*.vercel.app`); removidos código morto (`mockData.ts`, `server/src/seed.js` legado, `server/data/*`, `config.js/DATA_FILE`) e deps não usadas (`@tanstack/react-query`, `@tanstack/react-table`, `zustand`, `@supabase/supabase-js`, `zod`, `@hookform/resolvers`); **lint a 0 erros** (16 erros pré-existentes corrigidos: `no-unused-vars`, `no-empty-object-type`, directives obsoletas — restam 17 warnings documentados: `exhaustive-deps`×9, `react-refresh/only-export-components`×8).

**Incompleto (não implementado):** zod activation, socket.io (alertas reais), node-cron (relatório/stock automáticos), nodemailer, multer (upload real de PDF), pdfkit, pino, nanoid (código de presença), refresh tokens, CI GitHub Actions (opcional — deploy manual via `npm run deploy`).

**Planeado (ver `PLANO.md`):** confirmações de acções críticas (2 passos, movimentações, pendente/reverter); tabs em laboratório; ordem de chegada explícita em aprovações; validação de formulários em tempo-real + erros por campo.