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
- **✅ RF01b – Hardening básico**: `helmet` (headers de segurança) + `express-rate-limit` por camada (leituras GET 5000/15min, escritas POST/PUT/DELETE 1000/15min; reforçado no `/user/login` 20/15min) + CORS whitelist (`localhost`, `*.vercel.app` e `CORS_ORIGINS` por env; pedidos sem Origin aceites) — ✅ **[E4]**. 🔴 **[INCOMPLETO]** Refresh tokens com revogação + logout real no servidor: só existe JWT de acesso (12h) + logout no cliente.
- 🔴 **[INCOMPLETO]** Validação zod partilhada: **não implementada** (validação manual por rota).

### 2. Submissão de Propostas (Aulas, Visitas, Projetos e Estágios)
- **✅ RF03 – Criação de Atividade**: `POST /actividades` (ou `/actividades/full` atómico com detalhes+agendamentos+materiais).
- **✅ RF04 – Proposta de Calendário**: múltiplos blocos de data/hora no mesmo formulário, cada bloco com o seu `num_participantes` (obrigatório, `>= 1`).
- **✅ RF05 – Detalhes de Aula**: exige `curso_disciplina_id`; recolhe `tema`, `turno` (manha/tarde), `numero_turma`; `num_participantes` **em cada agendamento** (ver RF04). A atribuição de técnicos é por sessão e acontece na aprovação do Supervisor (ver RF10).
- ✅ RF06 – Detalhes de Projeto/Estágio: exige `responsavel` professor, datas macro. **🟡** `anexo_path` é submetido como texto/URL (`PUT /projectos/:id/documento` | `PUT /estagios/:id/documento`); upload real com multer 🔴 **[INCOMPLETO]**.
- **✅ RF07 – Vínculo de Aluno** (estágio): `estudante_id`.
- **✅ RF08 – Detalhes de Visita**: `nome_visitante`, `instituicao`, `telefone`, `email`.

### 3. Fluxo de Aprovação (modelo POR AGENDAMENTO INDEPENDENTE)
> Cada **agendamento (sessão)** é aprovado de forma independente e a decisão é um log imutável
> (`DecisaoAgendamento`). A atividade não tem marcadores de etapa: o estado é **derivado das sessões**
> (`pendente` → `em_andamento` → `rejeitada`/`realizada` — ver §4.2 e `server/src/utils/actividade_estado.js`).
> Ver modelagem em §4.2 (`DecisaoAgendamento`, `ActividadeEstado`, `AgendamentoEstado`) e PLANO.md §0.1.

- **✅ RF09 – Validação do DLab**: Coordenador DLab (ou Admin) vota em cada agendamento `nao_revisto` da atividade `pendente` → `agendamento.estado` passa a `aprovado_dlab` / `rejeitado`; pode também "Deixar pendente" (`POST /aprovacoes/pendente`, que **não** cria decisão). A **primeira** decisão de um agendamento da atividade muda-a para `em_andamento`.
- **✅ RF10 – Validação do Supervisor**: Supervisor (ou Admin) vota nos agendamentos `aprovado_dlab` **e** `pendente` (o que ficou pendente no DLab avança) → `aprovado_supervisor` / `rejeitado`. **Aprovar no Supervisor obriga a indicar o par `validador_id` + `assistente_id`** (mesma pessoa permitida; têm de ser `tipo='tecnico'`) — a decisão e as 2 linhas `AgendamentoTecnico` são gravadas atomicamente. Sessões `aprovado_supervisor` sem técnicos atribuídos podem ser corrigidas por Admin/Supervisor via `POST /agendamentos/:id/tecnicos` (sem re-atribuição após preenchimento).
- **✅ RF11 – Rejeição**: rejeição individual de agendamento (com justificação obrigatória) ou rejeição de todos os agendamentos em espera (`POST /aprovacoes/:id/rejeitar`, justificação obrigatória). **Bloqueado (409)** quando a atividade já tem sessões `aprovado_supervisor` ou `realizado` — rejeitar a atividade nesse ponto é impossível, só as sessões pendentes individualmente. O botão «Rejeitar Atividade» está **sempre visível**; fica **habilitado** só quando (i) nenhuma sessão está `realizado`, nenhuma está `aprovado_supervisor` e não estão todas `rejeitado`; **e** (ii) todas as sessões não-rejeitadas pertencem à mesma etapa **e** o utilizador tem permissão nessa etapa (cargos do `FluxoAprovacao`, admin sempre permitido). O cálculo é feito **no servidor** (`GET /aprovacoes/:id` devolve `pode_rejeitar_atividade`), sem duplicar a lógica de permissões no front. Quando desabilitado mostra label genérica de bloqueio; sem agendamentos mostra «Esta actividade ainda não tem agendamentos.». 📋 **[AVALIAR]** A label é **única** para os 5 casos de bloqueio (`realizado`, `aprovado_supervisor`, todas `rejeitado`, etapas mistas, sem permissão na etapa) — melhoria futura possível: o backend devolver um `motivo_bloqueio` (enum) em vez de só `pode_rejeitar_atividade` (booleano), permitindo ao front mostrar uma mensagem específica por caso.
- ✅ **Decisões imutáveis**: não existe rollback nem conclusão de etapa. Corrigir uma decisão implica eliminar/recriar a sessão (o que a atividade não faz automaticamente).
- ✅ **Votação em massa** (frontend e backend): `POST /aprovacoes/lote` sem `etapa` (deduzida de cada agendamento), com comentário único e justificação obrigatória se rejeitar. **No Supervisor só rejeitar em massa** (aprovar em lote devolve 400 — a aprovação exige o par de técnicos, logo é individual). 📋 **[AVALIAR]** O comentário **único partilhado pelo lote** é limitação conhecida (motivos de rejeição podem diferir entre agendamentos) — melhoria futura possível: expandir e personalizar o comentário por agendamento dentro do lote, colapsado por defeito; avaliar consoante feedback real (ver PLANO.md §2.8).
- 📋 **[PLANEADO]** Fluxo de aprovação configurável (cargos + ordem) — §3 do PLANO.md. O backend já lê `FluxoAprovacao`.
- 🔴 **[INCOMPLETO]** Sem notificação ao decisor seguinte quando um agendamento avança de etapa (socket/e-mail).

### 4. Calendário e Ocupação do Laboratório
- **✅ RF12 – Visualização do Calendário**: `GET /calendario` e `GET /agendamentos` listam **apenas agendamentos com `estado = aprovado_supervisor`**. Front: visões **mensal/semanal/diária** (✅ E2).
- **✅ RF13 – Bloqueio de Choques**: `POST /agendamentos` e o validador de `/actividades/full` rejeitam sobreposição no mesmo laboratório contra agendamentos `aprovado_supervisor` (409).
- **✅ RF14 – Confirmação de Presença**: `PUT /agendamentos/:id/confirmar-professor` (professor responsável) → `confirmado_professor_em`; `PUT /agendamentos/:id/confirmar-tecnico` (T validador da sessão) → `confirmado_tecnico_em`. **Qualquer uma das duas** confirmações, ao completar o par, marca `realizado = true` + baixa automática do stock pedido (`historico_materiais`, motivo `consumo_actividade`) num `$transaction`, **idempotente** (repetir não duplica stock) e **robusto a pedidos fora de ordem** (o último a confirmar finaliza a sessão). Ambos chamam `recalcularEstadoActividade` (a atividade pode ficar `realizada`).
  - 🔴 **[INCOMPLETO]** Notificação ao técnico (socket/e-mail) quando o professor confirma.
  - 🔴 **[INCOMPLETO]** Código de confirmação de presença (nanoid).

### 5. Gestão de Inventário (Materiais)
- **✅ RF15 – Inventário por Laboratório**: nome, categoria, quantidade (= SUM do histórico), unidade, estado, alerta de stock mínimo.
  - **✅ ** `UnidadeLaboratorial` (tipo de lab), `CategoriaMaterial` e `Unidade` (catálogo global) são **tabelas CRUD** desde o E0 (backend) — ver §4.2/§4.5; front ✅ **[E1]** via `SearchSelect` + `catalogoLabel` (PLANO.md §2.1).
- **✅ RF16 – Registo de Movimentação (Histórico)**: `historico_materiais` com `utilizador_id`, `quantidade_movimentada` (+/−), `motivo` (enum), `descricao` obrigatória, `agendamento_id` opcional (a sessão que originou o consumo;movimentos manuais ficam sem sessão).
- **✅ RF17 – Bloqueio de Edição Direta**: `materiais.quantidade` é cache denormalizado do `SUM(historico_materiais.quantidade_movimentada)` (util `utils/stock.js`); nunca editado diretamente; stock inicial entra como 1ª movimentação (`compra_stock`).
- 🟡 **RF18 – Alerta de Stock Mínimo**: badge visual (`StockAlertBadge`) quando `quantidade <= quantidade_minima`; as notificações do `NotificacoesContext` usam **dados mock** — 🔴 **[INCOMPLETO]** alertas reais via socket.io (não implementado) e checagem por cron.

### 6. Relatórios Dinâmicos
- **✅ RF19 – Geração de Relatório Mensal**: `POST /relatorios` (Admin/Técnico) conta agendamentos `realizado: true` do mês/lab e guarda `dados_json`. Exportação: **🟡** PDF mínimo construído à mão (`/relatorios/:id/pdf`); 🔴 **[INCOMPLETO]** pdfkit.
- 🔴 **[INCOMPLETO]** Relatório automático mensal (node-cron) — não implementado.

### Nota sobre Técnico vs Assistente (por sessão)
- Toda atividade precisa de um Técnico (**validador**) — confirma em 2º lugar a conclusão (RF14).
- O **assistente** é sempre atribuído em conjunto, por sessão, aquando da aprovação do Supervisor (mesma pessoa que o validador é permitida); não existe mais o toggle `precisa_assistente` na atividade.
- Ambos ligados por **`agendamento_tecnico`** (`AgendamentoTecnico`): `@@unique([agendamento_id, papel])`, `papel ∈ TecnicoTipo { validador, assistente }`.
- A atribuição acontece no ecrã Aprovação (**`AprovacaoDetalhe`** — modal de técnicos ao aprovar no Supervisor) e, em correcção, via `POST /agendamentos/:id/tecnicos` (Admin/Supervisor).

---

## 2. FLUXOS DE ATIVIDADES

- **Passo 1 — Registo e Perfis**: utilizadores criados pelo Admin (`POST /user`); cada utilizador edita o próprio perfil em `/perfil` (nome e senha; email/tipo só visíveis). ✅ Desde o E0: perfil não-admin usa `GET /user/me` e a troca de senha exige **senha actual** (`senha_actual`).
- **Passo 2 — Infraestrutura e Recursos**: CRUDs de laboratórios, cursos, disciplinas, curso-disciplinas, estudantes, materiais (stock inicial = 1ª movimentação).
- **Passo 3 — Submissão da Proposta**: formulário único (`ActividadeUpsertModal` multistep: Dados Base → Detalhes → Agendamentos → Materiais).
- **Passo 4 — Validação**: votos por agendamento no DLab e, depois, no Supervisor (`/aprovacoes/:id`, ou em massa via `POST /lote`); cada decisão é um log imutável (justificação obrigatória ao rejeitar). Aprovar no Supervisor abre o modal de técnicos (validador+assistente por sessão). No front: **Aprovar e Deixar pendente** (DLab) são **marcados** no card e persistidos com «Alterar decisão»/«Concluir»; **Rejeitar (qualquer etapa) e Aprovar no Supervisor resolvem de imediato no modal** (justificação guardada ao confirmar; fechar o modal sem confirmar = nada feito). Etapas configuráveis (`/configuracao/fluxo`).
- **Passo 5 — Impacto no Calendário e Baixa de Materiais**: agendamentos `aprovado_supervisor` passam a aparecer no calendário; no dia, professor confirma, depois técnico → `realizado` + baixa automática de stock.
- **Passo 6 — Ajustes Manuais de Inventário**: `HistoricoMaterialUpsertModal` (entrada/saída, motivo, justificação; `agendamento_id` em branco).
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
- `aprovacoes.service.ts` → listFila, get, listDecisoes, create, createLote, deixarPendente, rejeitarActividade
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
- `ActividadeEstado { pendente, em_andamento, rejeitada, realizada }` ← a atividade **não** tem marcadores de etapa: o estado é **derivado das sessões** por `recalcularEstadoActividade` (`utils/actividade_estado.js`); `rejeitada` = todas as sessões `rejeitado`, `realizada` = todas concluídas (≥1 `realizado`); a 1ª `DecisaoAgendamento` muda para `em_andamento`
- `AgendamentoEstado { nao_revisto, pendente, aprovado_dlab, aprovado_supervisor, rejeitado }`
- `AprovacaoEtapa { dlab, supervisor }` · `AprovacaoDecisao { aprovado, rejeitado }` (📋 **[PLANEADO]** tornar dinâmicas via `FluxoAprovacao` — §3 PLANO.md; backend de configuração ✅ E0)
- `MaterialCategoria { equipamento, composto, vidraria, consumivel }` → ✅ **[E0]** substituído por tabela `categorias_material`
- `MaterialEstado { disponivel, em_uso, manutencao, esgotado }` (mantido)
- `MovimentacaoMotivo { consumo_actividade, quebra_acidente, compra_stock, ajuste_inventario, outro }` (mantido)
- `TecnicoTipo { validador, assistente }` (mantido)
- `TurnoTipo { manha, tarde }` (extra vs. spec original)

Tabelas (resumo): `utilizadores`, `cursos`, `estudantes` (id = matrícula), `disciplinas`, `curso_disciplinas` (`@@unique [curso_id, disciplina_id]`), `laboratorios` (**`unidade_laboratorial_id`**), `materiais` (**`categoria_id` + `unidade_id`**), `historico_materiais` (**`agendamento_id`**), `actividades` (**`criado_por_id` + `responsavel_id`**), `actividade_materiais` (`@@unique [actividade_id, material_id]`), **`decisoes_agendamento`** (log imutável por agendamento), **`agendamento_tecnico`** (`@@unique [agendamento_id, papel]`, `papel ∈ TecnicoTipo { validador, assistente }` — ✅ E6 substitui `actividade_tecnico`), `agendamentos` (`estado`, **`num_participantes`**, `confirmado_professor_em`, `confirmado_tecnico_em`, `realizado`), `aulas` (`tema`, `turno`, `numero_turma`), `visitas`, `projectos` (`anexo_path`), `estagios` (`anexo_path`), `relatorios` (`dados_json` LongText), `fluxo_aprovacao` (E0 — etapas configuráveis), `unidades_laboratoriais`/`categorias_material`/`unidades` (catálogos E0).

> **Migração `20260926090000_agendamento_independente`** ✅ aplicada no Neon: cria `decisoes_agendamento` (com backfill a partir de `aprovacoes`/`aprovacao_agendamentos`), colapsa os estados legados em `pendente` antes de trocar a enum `ActividadeEstado`, move `num_participantes` para `agendamentos` e `actividade_id` do histórico para `agendamento_id`; no fim dropa `aprovacoes`/`aprovacao_agendamentos`. As tabelas `aprovacao*` **já não existem**.
>
> **Migrações `20260928000000_agendamento_tecnico` + `20260928010000_normaliza_estados`** ✅ [E6] aplicadas no Neon: criam `agendamento_tecnico` com backfill da atribuição antiga para as sessões `aprovado_supervisor` (validador e assistente, mesma pessoa quando só existia validador); dropam `actividade_tecnico` e `actividades.precisa_assistente`; adicionam `rejeitada`/`realizada` à enum e normalizam os estados das atividades existentes a partir das sessões.

📋 **[PLANEADO — E2]** — tela de catálogos/reconfiguração em `Configuracao.tsx` (✅ E2). Backend ✅ E0: `unidades_laboratoriais`, `categorias_material`, `unidades` (CRUD via `SearchSelect`/`catalogos.service.ts`), `fluxo_aprovacao` (etapas configuráveis; gestão no front em E2 ✅) e `decisoes_agendamento` (decisão em lote com comentário único; front de decisão em massa ✅ E2).

### 4.3. MODELS
Espelham as tabelas acima. Relações relevantes: `actividades` 1:1 com a especialização; 1:N com `agendamentos`, `actividade_materiais`; `agendamentos` 1:N com `decisoes` (log imutável), `historico_materiais` e `tecnicos` (`AgendamentoTecnico`); `materiais` 1:N `historico_materiais` (stock derivado); `utilizadores` 1:N `decisoes_agendamento` (decisor) e `agendamentoTecnicos`.

### 4.4. DTOS
Mappers em `utils/dto.js`. Notas de divergência face ao AGENTS.md original:
- `LoginResponse { user: {id,nome,email,tipo}, token }`.
- `ActividadeUpsert` usa `responsavel_id` (não `utilizador_id`); `ActividadeGet` inclui `criado_por_nome` e `responsavel_nome` (e **não** inclui `num_participantes` — vive no agendamento).
- `AgendamentoGet` inclui `estado`, `num_participantes` e o par `validador_id/nome` + `assistente_id/nome` (a partir de `agendamento_tecnico`).
- `AulaGet` inclui `tema`, `turno`, `numero_turma`, `turma` (derivada `CURSO{_M|T}{n}`).
- `toDecisaoGet` (substitui `toAprovacaoGet`) devolve `decisor_nome` e, quando o agendamento vem incluído, `agendamento_nome`/`h_inicio`/`h_fim`.
- `toHistoricoGet` devolve `agendamento_id` + `agendamento_nome` **apenas** quando existe agendamento ligado.

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

Actividades (`/actividades`): acesso base A,P,C,S,CD (P vê só as suas; T só as que lhe foram atribuídas via `agendamentos.tecnicos`). `GET /` (filtros tipo/estado/lab) · `GET /:id` · `POST /` · `PUT /:id` · `POST /full` · `PUT /:id/full` (atómico: +detalhes +agendamentos +materiais; valida RF13 e stock) · `DELETE /:id` · `GET /:id/aula|visita|projecto|estagio|materiais|agendamentos` (agendamentos inclui `tecnicos` por sessão).

Especializações: `POST /aulas|visitas|projectos|estagios` (upsert por `actividade_id`) · `PUT /projectos/:id/documento` · `PUT /estagios/:id/documento` · `POST /actividade-materiais` · `DELETE /actividade-materiais/:id`.

Agendamentos (`/agendamentos`): `GET /?laboratorio_id=&mes=&ano=&de=&ate=` (todos; só `aprovado_supervisor`; `de`/`ate` substituem `mes`/`ano` quando presentes — ✅ E2) · `POST /` (A,P,C,S,CD; valida RF13 e exige `num_participantes >= 1`) · `PUT /:id` (A,P,C,S,CD) · `DELETE /:id` (soft) · `PUT /:id/confirmar-professor` (P responsável, A) · `PUT /:id/confirmar-tecnico` (T validador da sessão, A) → quando ambos confirmam, `realizado` + baixa de stock (com `agendamento_id` no histórico; ordem indiferente, idempotente) · **✅ [E6]** `POST /:id/tecnicos` (A,S; só `aprovado_supervisor` sem atribuição; `{validador_id, assistente_id}` técnicos activos, mesma pessoa permitida; sem re-atribuição após preenchimento).

Aprovações (`/aprovacoes`): acesso A,C,S,CD. `GET /` (fila por agendamento, agrupada por atividade: devolve `{id,nome,estado,criado_em,em_espera}`; etapa filtrada via `FluxoAprovacao` — DLab vê `nao_revisto`, Supervisor vê `aprovado_dlab`+`pendente`, Admin vê ambas) · `GET /:id` (id = atividade; devolve a atividade + agendamentos com `etapa_alvo`, `pode_decidir`, as suas `decisoes` e o par validador/assistente, + `pode_rejeitar_atividade` calculado no servidor) · `POST /` (decisão individual: `{agendamento_id, etapa, decisao, comentario?, tecnicos?}`; comentário obrigatório se `rejeitado`; `tecnicos: {validador_id, assistente_id}` **obrigatório** quando o Supervisor aprova) · `POST /lote` (decisão em massa, **sem** `etapa`: `{itens:[{agendamento_id,decisao}], comentario?}`; no Supervisor **só rejeitar** — aprovar em lote devolve 400) · `POST /pendente` (não cria decisão) · `POST /:id/rejeitar` (`{comentario}` obrigatório; **409** quando a atividade já tem sessões `aprovado_supervisor`/`realizado`). **Removidos:** `POST /rollback` e `POST /:id/finalizar`. Histórico: `GET /actividades/:id/decisoes`.

Calendário: `GET /calendario?laboratorio_id=&mes=&ano=&de=&ate=` (todos; só `aprovado_supervisor`; `de`/`ate` substituem `mes`/`ano` — ✅ E2).

Catálogos e Configuração (`/configuracao` + novos routers — E0, escrita só A): `GET/POST/PUT/DELETE /unidades-laboratoriais` · `GET/POST/PUT/DELETE /categorias-material` · `GET/POST/PUT/DELETE /unidades` (motor de catálogos em `utils/catalogos.js`) · `GET/PUT /configuracao/fluxo` (A,C,S) · `POST /configuracao/fluxo/reset` (A).

Relatórios (`/relatorios`): `GET /` · `GET /:id` · `POST /` (A,T) · `GET /:id/pdf` (PDF mínimo) — acesso R: A,T,C,S,CD.

---

## 5. ESTADO DE IMPLEMENTAÇÃO (resumo)

**Implementado:** CRUDs de utilizadores/cursos/disciplinas/curso-disciplinas/estudantes/laboratórios/materiais; actividades `/full`; approvação por agendamento com decisões imutáveis; stock por movimentações (RF17) + alerta visual; confirmação em 2 passos com baixa automática de stock; relatórios manuais + PDF mínimo; RBAC por rota; JWT + argon2. **E0 (backend):** catálogos `unidades_laboratoriais`/`categorias_material`/`unidades` com CRUD; `fluxo_aprovacao` configurável; `POST /aprovacoes/lote`; `GET /user/me` + `senha_actual` no perfil; `GET /estudantes/:id/actividades`; filtros `de`/`ate` em `/agendamentos` e `/calendario`. **E1 (front):** `SearchSelect` (pesquisa + criar na hora) nos modais de lab/material + displays via `catalogoLabel`; `NumberInput` em todos os modais; `ResetPasswordModal` (fim de `window.prompt`); `FiltersBar`+`SimplePagination` em todas as listagens. **E2 (front):** detalhe de Estudante (tabs Geral/Actividades) e Curso (associação disciplina-turma) + chevrons nas listas; calendário mensal/semanal/diário + "Hoje" (+ `de`/`ate` no backend); tabs + decisão em massa no detalhe de Aprovação; tabs no detalhe de Atividade + histórico de decisões por agendamento; Perfil só com alteração de senha (senha actual exigida); tela `/configuracao` (fluxo + catálogos). **E3 (liga ▲ deploy ✔):** provider `postgresql` + `@prisma/adapter-pg`; `db.js` com `PrismaPg`; Neon ligado (pooled URL) com migração `init` versionada aplicada + seed; `api/index.js` + `vercel.json` (função Vercel + SPA fallback + `vercel-build`); `migrate:deploy`; `prisma.config.ts` com `directUrl`; `server/package.json` com deps backend; `.env.example` Postgres. **Deploy feito** → https://dlab-gray.vercel.app (verificado: `/api/health`, login e SPA em produção). — falta só o CI (opcional). **E4 (hardening/auditoria ✔ — backend local; redeploy pendente):** `helmet` + `express-rate-limit` (leituras GET 5000/15min + escritas 1000/15min + login 20/15min) + **CORS whitelist** por env `CORS_ORIGINS` (localhost, `*.vercel.app`); removidos código morto (`mockData.ts`, `server/src/seed.js` legado, `server/data/*`, `config.js/DATA_FILE`) e deps não usadas (`@tanstack/react-query`, `@tanstack/react-table`, `zustand`, `@supabase/supabase-js`, `zod`, `@hookform/resolvers`); **lint a 0 erros** (16 erros pré-existentes corrigidos: `no-unused-vars`, `no-empty-object-type`, directives obsoletas — restam 17 warnings documentados: `exhaustive-deps`×9, `react-refresh/only-export-components`×8).

**E5 (modelo por agendamento independente — backend + front + BD):** `DecisaoAgendamento` (log imutável) substitui `aprovacoes`+`aprovacao_agendamentos`; `ActividadeEstado` sem marcadores de etapa (estado derivado das sessões — valores finais em E6); `num_participantes` e `agendamento_id` (histórico) movidos para o agendamento; fila por estado (`nao_revisto` no DLab, `aprovado_dlab`+`pendente` no Supervisor, duas etapas activas em simultâneo); `POST /aprovacoes/lote` sem `etapa`; removidos `POST /rollback` e `POST /:id/finalizar`; histórico em `GET /actividades/:id/decisoes`; front: participantes por sessão (com prefill das existentes), decisões por agendamento, origem no histórico de materiais. Migração `20260926090000_agendamento_independente` **aplicada no Neon** com dados preservados (verificar `prisma migrate status` antes de deploy). **Sem deploy** — https://dlab-gray.vercel.app continua a servir a versão anterior; redeploy requer decisão do utilizador.

**E6 (técnicos por sessão + estados derivados — backend + front + BD, deploy pendente):** `AgendamentoTecnico` (`agendamento_tecnico`) substitui `actividade_tecnico`; o par **validador+assistente** é **obrigatório por sessão na aprovação do Supervisor** (gravação atómica: decisão + 2 linhas, mesma pessoa permitida) e para correcção via **`POST /agendamentos/:id/tecnicos`** (Admin/Supervisor, só `aprovado_supervisor` sem atribuição); removidos `precisa_assistente` e o ecrã "Técnico & Assistente" da atividade (técnicos agora por sessão no detalhe de Atividade/Aprovação); `ActividadeEstado` fecha em `{pendente, em_andamento, rejeitada, realizada}` com derivação central em `recalcularEstadoActividade` (chamada nas decisões, pendente, confirmar-tecnico e atribuição); RF14 (`confirmar-tecnico`) valida o validador **da sessão**; no front, **Aprovar e Deixar pendente (DLab) são marcados no card** (persistidos com «Alterar decisão»/«Concluir») e **Rejeitar (qualquer etapa) + Aprovar no Supervisor resolvem de imediato no modal** (justificação e técnicos guardados ao confirmar; fechar sem confirmar = nada feito); lote no Supervisor só rejeitar; `POST /aprovacoes/:id/rejeitar` bloqueado (409) com mensagem específica; sessão legada **#8** corrigida (Ana, validador+assistente). Migrações `20260928000000_agendamento_tecnico` + `20260928010000_normaliza_estados` **aplicadas no Neon** com dados preservados (backfill técnicos + estados normalizados); sessão **#10** (já `realizado`) fica sem técnicos por decisão do utilizador. **Sem deploy**. **Correcções pós-E6 (backend + front, sem migração):** a finalização RF14 passou a ser **comum aos dois confirm-endpoints** (`finalizarSeCompleto`: reavalia a sessão dentro da transação, robusta a ordem invertida/concorrência, idempotente; re-consulta devolve estado actual); rejeição DLab/Supervisor **grava de imediato no modal**; botões de confirmação desactivados enquanto o pedido corre + tratamento de erro (não 2 cliques → menos 429; mensagem clara no 429); registo inconsistente **ag#17** (confirmações completas sem `realizado`) normalizado no Neon; **taxa-limite por camada** (leitura `5000`/escrita `1000`/login `20` por 15min) para o uso normal do front não ser bloqueado; **`load()` do detalhe de Atividade deduplicado e imune a respostas obsoletas** (StrictMode em dev montava o componente 2× e disparava o conjunto de 8 leituras 2×; agora o `load` ignora um segundo pedido da mesma atividade em curso e descarta respostas de navegações/trocas de conta anteriores).

**Incompleto (não implementado):** zod activation, socket.io (alertas reais), node-cron (relatório/stock automáticos), nodemailer, multer (upload real de PDF), pdfkit, pino, nanoid (código de presença), refresh tokens, CI GitHub Actions (opcional — deploy manual via `npm run deploy`).

**Planeado (ver `PLANO.md`):** confirmações de acções críticas (2 passos, movimentações, pendente/reverter); tabs em laboratório; ordem de chegada explícita em aprovações; validação de formulários em tempo-real + erros por campo. **A avaliar (feedback real):** comentário por agendamento dentro do lote (expandível, colapsado por defeito — §2.8); (re)ativação, remoção ou novo propósito do botão «Rejeitar Atividade» (RF11); mensagem específica por motivo de bloqueio do botão «Rejeitar Atividade» — backend devolver `motivo_bloqueio` (enum) em vez de só `pode_rejeitar_atividade` (RF11).