# PLANO — DLab (Roteiro de Implementação Evolucionária)

> Documento vivo: cada item implementado deve ser movido para o estado "✅ implementado"
> no `AGENTS.md`. As alterações abaixo seguem o formato **Como está agora / O problema /
> Como deve ficar / Que alterações fazer**. O capítulo 5 contém a auditoria final com
> todas as inconsistências (segurança, funcionalidade, padronização).

## 0. DECISÕES DE ARQUITECTURA TOMADAS (consenso)

1. **Estado da atividade**: mantêm-se `revisado_dlab`/`revisado_supervisor` (marcadores de etapa). O AGENTS.md já foi actualizado; não renomear para `aprovado_*`.
2. **Modelo de aprovação**: permanece **por agendamento** (votos individuais + conclusão de etapa). O AGENTS.md documenta este modelo como o actual.
3. **Pendentes não bloqueiam avanço**: agendamentos deixados `pendente` ficam incompletos **apenas na etapa actual**; os já decididos avançam. Admite-se **duas etapas activas** na mesma atividade.
4. **Enums → CRUD**: convertidos apenas `UnidadeLaboratorial` (tipo de lab) e `CategoriaMaterial`. Os restantes enums (estado de material, motivo de movimentação, departamento, cargos, tipos de atividade/papel/turno) **ficam como enums fixos** — ver análise em §2.1.
5. **Unidade do material**: passa a CRUD **global** (`unidades`), migrando os valores existentes (`ml`, `un`, `g`).
6. **Neon + Vercel**: análise concluída em §4 — **schema único Postgres** em todos os ambientes (dev local = Postgres via Docker ou Neon dev branch; staging = Neon + Vercel). MySQL deixa de ser o dev base.
7. **Histórico de aprovação**: agrupamento **por lote** — uma `Aprovacao` (etapa + decisão + comentário únicos) com N agendamentos via tabela de ligação `aprovacao_agendamentos`.
8. **Entregável**: este `PLANO.md` + `AGENTS.md` actualizado.

---

## 2. ALTERAÇÕES PLANEADAS

### 2.1. Estrutura e CRUDs (unidade laboratorial, categorias, unidade, enums, SearchSelect)

> **Estado:** ✅ (E0 backend + E1 front) — modelos + CRUD `/unidades-laboratoriais`, `/categorias-material`, `/unidades` + `utils/catalogos.js`; `Laboratorio.unidade_laboratorial_id`, `Material.categoria_id`/`unidade_id`; front: `SearchSelect` (Pesquisa + "Criar na hora") aplicado em `MaterialUpsertModal`/`LaboratorioUpsertModal`, displays migrados para `catalogoLabel(...)`.

#### Como está agora
- `Laboratorio.tipo` é o enum fixo `LaboratorioTipo { quimica, fisica, outro }`; o modal `LaboratorioUpsertModal` e a lista `LaboratoriosList` usam `LABORATORIO_TIPO_OPTIONS` (estáticos em `services/enums.ts`).
- `Material.categoria` é o enum fixo `MaterialCategoria { equipamento, composto, vidraria, consumivel }`; `MaterialUpsertModal` usa `MATERIAL_CATEGORIA_OPTIONS`.
- `Material.unidade` é **string livre** (input de texto em `MaterialUpsertModal.tsx:119`, `unidade: string` nos types) — sem nenhum catálogo; seed usa `ml`/`un`/`g`.
- Não existe nenhum componente de dropdown com pesquisa (o `Command`/cmdk está instalado mas não é usado; `Popover` disponível).

#### O problema
- Não se podem criar/renomear/eliminar tipos de laboratório ou categorias sem deploy (hardcoded no código e no enum MySQL).
- `unidade` livre gera inconsistências (`ml` vs `Ml` vs `mililitro`) e não permite catálogo partilhado.
- Os modais com listas grandes (cursos, disciplinas, materiais, utilizadores, trabalhadores) usam `Select` simples sem pesquisa — ilegível com muitos registos e sem opção de criar registo novo no contexto.
- Os outros enums avaliados **devem ficar fixos** por serem invariantes de negócio/segurança: `UtilizadorTipo` (RBAC), `ActividadeTipo` (discriminador), `TecnicoTipo` (validador/assistente), `TurnoTipo`, `AgendamentoEstado`, `AprovacaoEtapa/Decisao`, `MaterialEstado` e `MovimentacaoMotivo` (usados em lógica transacional; convertê-los implicaria fKs dinâmicas e perda de integridade sem ganho). `DepartamentoTipo` fica enum (dados de catálogo pequeno e estável).

#### Como deve ficar
- Duas tabelas CRUD novas: `unidades_laboratoriais` (id, nome, abreviacao?, activo) e `categorias_material` (id, nome, activo) + tabela `unidades` (id, nome, sigla, activo) **global**.
- `Laboratorio.tipo` passa a `unidade_laboratorial_id` (FK); `Material.categoria` passa a `categoria_id` (FK); `Material.unidade` passa a `unidade_id` (FK).
- As migrações criam as tabelas, fazem seed (`quimica/fisica/outro`; `equipamento/composto/vidraria/consumivel`; `ml/un/g`) e convertem os dados existentes (mapeamento 1:1 por nome).
- Novo componente `SearchSelect` (base `Command` + `Popover`): pesquisa por texto, **multiselect** (checkbox) opcional e acção **"Criar novo"** inline que abre mini-formulário e devolve o registo criado. Substitui o `Select` simples em todos os pontos que consomem dados de CRUDs (laboratórios, categorias, unidades, cursos, disciplinas, curso-disciplinas, estudantes, materiais, técnicos, responsáveis).

#### Que alterações fazer
Backend:
1. `server/prisma/schema.prisma`: novos models `UnidadeLaboratorial`, `CategoriaMaterial`, `Unidade`; `Laboratorio.tipo` → `unidade_laboratorial_id Int` + relação; `Material.categoria`/`unidade` → `categoria_id`/`unidade_id` + relações. Aplicar com `prisma db push` + script de backfill (novo `server/scripts/backfill-catalogs.js`).
2. Novo módulo `server/src/modules/catalogos.routes.js`: CRUD de `/unidades-laboratoriais`, `/categorias-material`, `/unidades` (gestão A; leitura para todos os roles com acesso à área de recursos). `GET` devem incluir `{ id, nome, ... , activo }`.
3. `server/src/utils/dto.js`: `toLabGet` passa a expor `unidade_laboratorial_id`/`unidade_laboratorial_nome` (ou `tipo` derivado para não quebrar o front existente durante a transição); `toMaterialGet` expõe `categoria_id`, `categoria_nome`, `unidade_id`, `unidade_nome`.
4. `materiais.routes.js` e `laboratorios.routes.js`: validar que `categoria_id`/`unidade_id`/`unidade_laboratorial_id` existem e estão `activo`.

Frontend:
5. `src/services/enums.ts`: manter as `LABELS`/`OPTIONS` fixas apenas para os enums que continuam; criar `catalogos.service.ts` (`listUnidadesLab`, `createUnidadeLab`, …).
6. Novo `src/components/ui/search-select.tsx` (`SearchSelect`) com props `{ value: string | string[]; options; onOpenChange; onChange; onCreate?: (nome) => Promise<{id,nome}>; multiple?: boolean; placeholder }`. Usar `Command` + `Popover` + `CommandEmpty` → item "Criar «texto»" quando `onCreate` existe.
7. Actualizar `MaterialUpsertModal`, `LaboratorioUpsertModal`, `HistoricoMaterialUpsertModal` e (onde fizer sentido) os selects de `ActividadeUpsertModal`/`CursoUpsertModal`/`EstudanteUpsertModal` para `SearchSelect`.
8. `types/material.types.ts` e `types/laboratorio.types.ts`: reflectir os novos ids/nomes.

### 2.2. Telas de listagem (filtros + paginação em todas + ordem de chegada nas aprovações)

> **Estado:** ✅ (E1) — `FiltersBar` + `SimplePagination` aplicados em `LaboratoriosList` (nome + unidade), `CursosList` (nome + departamento), `DisciplinasList` (nome), `AprovacoesList` (nome + etapa), `RelatoriosList` (laboratório). Pendente do item: botão/shortcut de ordenação explícito na fila de aprovações (ver §2.6).

#### Como está agora
- Têm `FiltersBar` + `SimplePagination`: Utilizadores, Estudantes, Actividades, Materiais, Histórico.
- **Não têm**: `LaboratoriosList`, `CursosList`, `DisciplinasList`, `AprovacoesList`, `RelatoriosList` (tabelas simples sem filtros/paginação).
- `AprovacoesList` ordena pelo que vem do backend (`GET /aprovacoes` ordena por `criado_em` via `orderBy: {id:'asc'}`) — sem filtro explícito nem controlo de ordenação no UI.

#### O problema
- Listas de laboratórios/cursos/disciplinas/aprovações/relatórios ficam insustentáveis com volume; quebra o padrão visual das restantes.
- Aprovações precisam de **ordem de chegada** claramente representada (mais antigas primeiro) e filtros por estado/etapa/laboratório.

#### Como deve ficar
- Todas as listagens têm `PageHeader` + `FiltersBar` + `Table` + `SimplePagination` (client-side, `PAGE_SIZE=10`), mesmo recorte visual.
- `AprovacoesList`: filtros por nome, etapa, laboratório + botão/shortcut de ordenação **"Chegada (mais antigo primeiro)"** (default) — a fila já vem por `id asc`; o filtro passa a ser explícito e persistente.

#### Que alterações fazer
1. `LaboratoriosList`: filtro `nome` (texto) + paginação; ação de chevron para `/labs/:id` já existente.
2. `CursosList`: filtro por nome + departamento (enum fixo) + paginação.
3. `DisciplinasList`: após §2.5 fica só o CRUD de disciplinas; adicionar filtro `nome` + paginação.
4. `AprovacoesList`: adicionar `FiltersBar` (nome, etapa, laboratório — buscar labs via `laboratoriosService.list()`) + `SimplePagination`. Reforçar a ordenação por `criado_em/id asc` no service (`listFila`) e expor opção de ordenação.
5. `RelatoriosList`: filtros (laboratório, mês/ano) + paginação.
6. Reutilizar sempre `FilterField` (`type: 'text' | 'select'`) — nenhuma nova lista deve implementar filtros próprias.

### 2.3. Modais e confirmações (sem `confirm()`/`alert()` nativos; confirmação de acções críticas)

> **Estado:** parcial ✅ (E1) — `window.prompt` eliminado com novo `ResetPasswordModal` (confirma nova senha) em `UtilizadoresList`. Pendente: confirmação de acções críticas (confirmar técnico/professor, movimentações de stock, deixar pendente/reverter).

#### Como está agora
- ~~Única ocorrência~~ (eliminada no E1) — era `window.prompt` em `UtilizadoresList.tsx:59` (repor senha), substituído por `ResetPasswordModal`.
- Restantes acções críticas executam **sem confirmação**: `confirmarTecnico` (baixa de stock automática!) e `confirmarProfessor` em `ActividadeDetalhe.tsx`; criar movimentação de stock em `HistoricoMaterialUpsertModal`; "Deixar pendente"/"Rever decisão" em `AprovacaoDetalhe`.
- Restantes destrutivos já usam `ConfirmDialog`.

#### O problema
- `window.prompt` quebra o padrão e é feio/inseguro (senha em prompt nativo).
- Confirmação em 2 passos (RF14) e movimentações de stock alteram dados de inventário; executar sem confirmação permite erros indesejados.

#### Como deve ficar
- Zero `confirm()/alert()/prompt()` nativos no código.
- Modal próprio `ResetPasswordModal` (Dialog com campo de nova senha + validação) substitui o `window.prompt`.
- `ConfirmDialog` em todas as acções críticas: confirmação professor, confirmação técnico (avisa que baixa o stock), registo de movimentação de stock (±), submeter/repor documento, deixar pendente.

#### Que alterações fazer
1. Remover `windows.prompt` de `UtilizadoresList.tsx`; criar `components/modal/ResetPasswordModal.tsx` (usa `ConfirmDialog`/`Dialog` + `utilizadoresService.resetPassword`).
2. `ActividadeDetalhe.tsx`: envolver `handleConfirmProf`/`handleConfirmTec` em `ConfirmDialog`; no caso do técnico, descrição com aviso de baixa automática de stock.
3. `HistoricoMaterialUpsertModal`: confirmar antes de submeter quando saída (`-`); mostrar resumo (material, quantidade, motivo).
4. `AprovacaoDetalhe`: colocar "Deixar pendente" e "Rever decisão" sob `ConfirmDialog`.
5. Script de verificação: adicionar ao lint uma regra/eslint disable negativo ou grep no CI para `window\.(confirm|alert|prompt)`.

### 2.4. Tela de detalhes do estudante (tabs Geral / Actividades)

> **Estado:** ✅ (E0 backend + E2 front) — `GET /estudantes/:id/actividades` + `toEstagioActividadeGet`; página `EstudanteDetalhe.tsx` em `/estudantes/:id` com tabs Geral (nome/matrícula/curso) e Actividades (tabela tipo/estado/lab/período, linhas → `/actividades/:id`); `EstudantesList` com chevron para o detalhe.

#### Como está agora
- `EstudantesList` (filtros+paginação+CRUD) não tem página de detalhe; rota `/estudantes/:id` não existe.
- Backend: `GET /estudantes/:id` existe (DTO com `curso_nome`); **não** existe endpoint de actividades do estudante.

#### O problema
- Não há onde ver o histórico do estudante (estágios/actividades associadas).

#### Como deve ficar
- Nova página `EstudanteDetalhe` em `/estudantes/:id`, com tabs:
  - **Geral**: header (nome, nº matrícula, curso) + dados do `GET /estudantes/:id`;
  - **Actividades**: tabela de actividades em que o estudante participa (via `estagios.estudante_id`), com estado e agendamentos.

#### Que alterações fazer
1. Backend: novo endpoint `GET /estudantes/:id/actividades` (A,P,C,S,CD) — `estagio.findMany({ where: { estudante_id: id } })` + join `actividade` (nome, tipo, estado, laboratorio_nome) + agendamentos aprovados.
2. Service: `cursos.service.ts` (ou novo `estudantes.service.ts`) → `listActividades(estudanteId)`.
3. Router (`AppRouter.tsx`): rota `/estudantes/:id` (A,P,C,S,CD) com `Suspense`.
4. Nova página com `Tabs` (`ui/tabs.tsx`); na tab Actividades usar `Table` + `formatEstado`/`formatTipo`, linhas clicáveis para `/actividades/:id`.
5. `EstudantesList`: adicionar acção chevron/ver para `/estudantes/:id`.

### 2.5. Curso e Disciplina (detalhe do curso + movimentação da tabela de associação)

> **Estado:** ✅ (E2 front) — `CursoDetalhe.tsx` em `/cursos/:id` (header departamento/abreviação + form de associação com `SearchSelect` + tabela Disciplina/Ano·Sem sem coluna Curso + filtros/paginação; edição só A); `DisciplinasList` reduzida ao CRUD de disciplinas.

#### Como está agora
- `CursosList` sem página de detalhe (`/cursos/:id` não existia).
- `DisciplinasList` continha: (a) tabela de disciplinas (CRUD) e (b) card "Associação Curso ↔ Disciplina" com form + tabela de `cursoDisciplinas` (com coluna Curso). **[E2]** — o card de associação foi movido para `CursoDetalhe`.

#### O problema
- A associação curso–disciplina vive na página de Disciplina, quando pertence ao contexto do curso.
- Sem detalhe de curso não há onde navegar para ver o plano de disciplinas de um curso.

#### Como deve ficar
- Nova página `CursoDetalhe` em `/cursos/:id`:
  - **Header**: nome, departamento, abreviação (dados do `GET /cursos/:id`);
  - **Abaixo do header**: tabela de associação curso–disciplina **daquele curso** (colunas Disciplina, Ano·Sem, Ações) + form de associar (usando `SearchSelect`).
  - A tabela de associação **não tem coluna "Curso"** (implícito pelo contexto).
- `DisciplinasList` fica apenas com o CRUD de disciplinas (nome + acções), com filtro+paginação.

#### Que alterações fazer
1. Backend: `GET /curso-disciplinas?curso_id=` já existe — usar no detalhe (o `cursosService.listCursoDisciplinas(cursoId)` já envia `curso_id`). (Opcional) `PUT /curso-disciplinas/:id` para alterar semestre (hoje inexistente).
3. `AppRouter.tsx`: rota `/cursos/:id` (todos os roles autenticados; edição só A).
4. Nova página `CursoDetalhe.tsx` com a tabela vinda de `DisciplinasList` (removida a coluna Curso) + `FiltersBar`+`SimplePagination`.
5. Refactor `DisciplinasList.tsx`: remover o card de associação; manter CRUD + filtro `nome` + paginação (§2.2).

### 2.6. Detalhe de laboratório (tabs Geral / Materiais / Agendamentos)

#### Como está agora
- `LaboratorioDetalhe` mostra: card de descrição + 2 cards laterais (Materiais do Laboratório, Agendamentos Futuros).

#### O problema
- Conteúdo empilhado em grid com cards fixos, limitado (10 futuros), sem contexto dedicado.

#### Como deve ficar
- Tela com `Tabs`: **Geral** (descrição + dados do laboratório), **Materiais** (tabela completa com stock/alerta, navegável para `/materiais/:id`, com `FiltersBar`+`SimplePagination`), **Agendamentos** (tabela de agendamentos `aprovado_supervisor` do lab, futuros e passados, com estado e link para `/actividades/:id`).

#### Que alterações fazer
1. `LaboratorioDetalhe.tsx`: adicionar `Tabs.Root` com os 3 painéis; mover o conteúdo actual; carregar materiais e agendamentos por tab (lazy) ou manter Promise.all actual.
2. Enriquecer a tab Agendamentos para usar `getTime`/ordenação e mostrar todos (não só 10 futuros).
3. Aproveitar `StockAlertBadge` na tab Materiais.

### 2.7. Calendário (visões mensal/semanal/diária, selecção de data, "Hoje", dias vazios visíveis)

#### Como está agora
- `Calendario.tsx` é **mensal** fixo (inicia em Jun/2026), navegação ‹ mês ›, filtro de laboratório, badges de agendamentos `aprovado_supervisor`, alerta de choques; todos os dias do mês são sempre desenhados (dias vazios já visíveis).

#### O problema
- Sem visão semanal/diária, sem campo de data editável, sem atalho "Hoje". A data inicial fixa (Jun/2026) está desactualizada.

#### Como deve ficar
- Controlo de visão: `Mês | Semana | Dia` (tabs/segmented).
- Selecção de data: input `type=date` editável + picker (dropdown) que muda a janela conforme a visão; atalho "Hoje".
- Mensal: todos os dias visíveis (inclui vazios — manutenção do comportamento actual).
- Semanal: 7 dias a partir da data seleccionada; Diária: dia → timeline com horas.
- Filtro de laboratório mantido; badges clicáveis para `/actividades/:id`; alerta de choque por dia.

#### Que alterações fazer
1. `Calendario.tsx`: estado `view: 'mes'|'semana'|'dia'`, `baseDate` (Date) em vez de `currentDate` fixo; contruir células por visão com `date-fns`.
2. Nav: ‹ › deslocam mês/semana/dia conforme a visão; botão "Hoje" faz `setBaseDate(new Date())`.
3. Input date (`type=date`) sincronizado com `baseDate`.
4. Reutilizar `StartOfWeek` (date-fns) e `DIAS_SEMANA`; desenhar dias vazios (células `bg-muted/30` — actual) preservando o requisito de não ocultar dias sem agendamentos.
5. `GET /calendario` mantém filtro lab/mês/ano; para visão semanal/diária pode-se usar `mes/ano` da data expandida ou adicionar `de`/`ate` ao endpoint (recomendado: adicionar `?de=&ate=` opcionais).

> **Estado:** ✅ (E2) — `Calendario.tsx` com visões Mês/Semana/Dia (tabs), navegação ‹ › adaptada à visão, botão "Hoje", input `type=date`; backend `/agendamentos` e `/calendario` com filtro opcional `de`/`ate`.

### 2.8. Detalhe de aprovação (cards → tabs, decisão em massa)

> **Estado:** ✅ (E0 backend + E2 front) — `POST /aprovacoes/lote` + `AprovacaoAgendamento`; `AprovacaoDetalhe.tsx` com Tabs (Agendamentos/Materiais/Técnico & Assistente/Decisão) e painel de decisão em massa (checkbox multi-selecção + "Marcar todos" + decisão única + comentário único).

#### Como está agora
- `AprovacaoDetalhe` (rota `/aprovacoes/:id`) = grid de cards: Dados da Actividade, Agendamentos Propostos, Materiais Solicitados, Técnico & Assistente, Decisão.
- Cada agendamento tem botões individuais Aprovar/Rejeitar/Deixar pendente/Rever decisão.

#### O problema
- Sem tabs, a tela satura com várias actividades; decidir "data a data" é lento.
- Cada decisão gera uma `Aprovacao` por agendamento (comentário repetido).

#### Como deve ficar
- `Tabs`: **Agendamentos** (votação), **Materiais**, **Técnico & Assistente**, **Decisão** (concluir/rejeitar) — "Dados da Actividade" passa a header.
- **Decisão em massa**: `SearchSelect`/checkbox multiselect dos agendamentos votáveis + selects de "Decisão" (Aprovar/Rejeitar/Deixar pendente) aplicados a todos de uma vez (com comentário único obrigatório no lote).
- Voto em lote ⇒ uma `Aprovacao` com N agendamentos ligados (modelo §2.10).

#### Que alterações fazer
1. Backend (`aprovacoes.routes.js`): novo `POST /aprovacoes/lote` com body `{ agendamento_ids: [], etapa, decisao, comentario? }` — numa transação: valida sequência/estado de cada agendamento, actualiza estados e cria **uma** `Aprovacao` + ligações `aprovacao_agendamentos` (novo model). `delete`/`rollback` do lote reverte todos.
2. Schema: novo model `AprovacaoAgendamento` (`aprovação_id`, `agendamento_id`, `@@unique([aprovacao_id, agendamento_id])`); `Aprovacao.agendamento_id` passa a legado/opcional (manter por compatibilidade ou migrar).
3. `AprovacaoDetalhe`: reestruturar com `Tabs`; painel de votação com selecção múltipla e botão aplicar decisão.
4. Service `aprovacoes.service.ts`: `createLote(data)` + ajustar `listByActividade` para devolver agendamentos por aprovação.

### 2.9. Detalhe da atividade (cards → tabs)

> **Estado:** ✅ (E2) — `ActividadeDetalhe.tsx` com Tabs Geral/Agendamentos/Materiais/Documento/Histórico; header com nome/tipo/estado + laboratório; "Geral" agrupa informação + detalhes do tipo + técnico & assistente.

#### Como está agora
- `ActividadeDetalhe` = grid de 7 cards (Informação Geral, Detalhes, Agendamentos, Técnico & Assistente, Materiais, Documento, Histórico de Aprovações).

#### O problema
- Empilhamento pesado; "Informação Geral" + "Detalhe" + "Técnico" repetem informação e podem ficar juntos.

#### Como deve ficar
- Header (nome, tipo, estado, laboratório) e `Tabs`:
  - **Geral** = "Informação geral" + "Detalhe (tipo)" + "Técnico & Assistente" (per decisão do utilizador, ficam no mesmo painel);
  - **Agendamentos** (com confirmações professor/técnico);
  - **Materiais**;
  - **Documento** (só projecto/estágio);
  - **Histórico de Aprovações** (ver §2.10).

#### Que alterações fazer
1. `ActividadeDetalhe.tsx`: refactor em `Tabs`; agrupar os 3 painéis pretendidos no painel "Geral".
2. Mover "Histórico de Aprovações" para um card/tab com lista por lote (ver §2.10).

### 2.10. Histórico de aprovação (agrupamento por lote, comentário único, agendamentos afectados)

> **Estado:** ✅ (E0 backend + E2 front) — `AprovacaoGet.agendamentos[]` + histórico agrupado em `GET /actividades/:id/aprovacoes`; tab "Histórico" agrupa por lote (aprovador, etapa, decisão, comentário único, data) com lista de agendamentos afectados (badge por decisão + horário); decisões antigas agrupadas visualmente por `(etapa, decisao, comentario, aprovador, decidido_em)`.

#### Como está agora
- `GET /actividades/:id/aprovacoes` devolve **uma linha por voto**; decisões em lote ainda não existem — mas hoje, ao votar vários agendamentos com o mesmo comentário, cada voto tem o seu próprio `Aprovacao.comentario` repetido.
- `ActividadeDetalhe`/`AprovacaoDetalhe` mostram o histórico como lista de cartões, sem listar os agendamentos afectados.

#### O problema
- O mesmo comentário aparece duplicado (uma vez por agendamento) e não há ligação entre um parecer e o conjunto de agendamentos que afectou.

#### Como deve ficar
- Histórico agrupado **por lote**: cada item mostra aprovador, etapa, decisão, comentário único, data, e a **lista de agendamentos afectados** (tanto aprovados como rejeitados).
- Para decisões antigas (pré-lote), o front agrupa visualmente por `(etapa, decisao, comentario, aprovador, decidido_em)` sem tocar nos dados.

#### Que alterações fazer
1. Schema: `AprovacaoAgendamento` (como §2.8); `GET /actividades/:id/aprovacoes` expande `include: { aprovacaoAgendamentos: { include: { agendamento: true } } }`.
2. DTO `toAprovacaoGet` inclui `agendamentos: [{ id, hora_inicio, hora_fim, estado }]`.
3. `ActividadeDetalhe`/`AprovacaoDetalhe`: renderizar agendamentos afectados por aprovação (badge Aprovado/Rejeitado por agendamento + horário).
4. Backfill: manter `Aprovacao.agendamento_id` antigo e derivar `agendamentos` via ligação quando existir, senão `[agendamento_id]`.

### 2.11. Fluxo de aprovação de agendamentos (pendentes não bloqueiam avanço — duas etapas activas)

> **Estado:** ✅ (E0) — implementado e validado em smoke test (atividade avança com agendamento não decidido da etapa).

#### Como está agora
- `finalizar` (DLab) exige zero `nao_revisto`; `finalizar` (Supervisor) exige **todos** `aprovado_supervisor`|`rejeitado` — qualquer `pendente` bloqueia a conclusão final; a atividade tem um único estado de etapa (`pendente|revisado_dlab|revisado_supervisor|rejeitado`).
- O `POST /aprovacoes/pendente` (DLab) serve apenas para adiar; o supervisor nunca pode deixar pendente.

#### O problema
- Comportamento pretendido (decisão 3): agendamentos **pendentes ficam pendentes** — incompletos só na etapa actual — enquanto os **já decididos avançam**. Duas etapas podem estar activas na mesma atividade (ex.: DLab ainda a aguardar o horário do dia 15, enquanto os outros já estão no Supervisor).

#### Como deve ficar
- Cada agendamento passa a ter **progressão de etapa própria**; o estado da atividade torna-se um **agregado derivado**:
  - `nao_revisto`/`pendente`+etapa → "incompleto na etapa da fila";
  - `aprovado_dlab` → prontos para Supervisor;
  - `aprovado_supervisor` → concluídos (vão ao calendário);
  - `rejeitado` → terminados.
- `finalizar` passa a: avançar **apenas os agendamentos elegíveis** para a etapa seguinte, mantendo os `pendente` no agendamento sem os bloquear; o marcador da atividade reflecte a etapa mais avançada activa (ex.: `revisado_dlab` com alguns ainda a aguardar DLab → a fila do Supervisor mostra os `aprovado_dlab` enquanto a fila do DLab mostra os `pendente`).
- Um `pendente` **não entra no calendário** enquanto não for aprovado pelo Supervisor.
- O Supervisor também pode "deixar pendente" (adiar a sua decisão) como o DLab.

#### Que alterações fazer
1. Schema: manter enums; adicionar coluna `Agendamento.etapa_actual`/`pendente_em` (timestamps) para controlo de per-agendamento (alternativa: derivar de `estado` + aprovações). Recomendado derivar — sem nova coluna no primeiro corte.
2. `aprovacoes.routes.js`:
   - `POST /aprovacoes/:id/finalizar` (DLab): já não exige que todos estejam `decididos`; apenas não permite avançar agendamentos `nao_revisto` **não votáveis** que estejam com o DLab; os `pendente` ficam como estão; marcador da atividade passa a derivado.
   - `POST /aprovacoes/:id/finalizar` (Supervisor): conclui a etapa para os `aprovado_dlab`; `pendente` ficam aguardando; a atividade só atinge `revisado_supervisor` completo quando não restarem agendamentos em etapas anteriores.
   - Filas (`GET /aprovacoes`): devolver também actividades com "etapas activas mistas"; UI mostra quantidade de agendamentos por etapa.
3. `POST /aprovacoes/pendente` disponível também na etapa Supervisor.
4. Front `AprovacaoDetalhe`: mostrar claramente "etapa actual por agendamento", agrupados (votáveis esta etapa / aguardando etapa anterior), e avisos quando "concluir" avança parcialmente.
5. Guardar comentário de conclusão como `Aprovacao` de etapa com agendamentos avançados listados.

### 2.12. Perfil do utilizador (senha actual exigida; correcção perfil não-admin; remoção de campos)

> **Estado:** ✅ (E0 backend + E2 front) — `GET /user/me` + `senha_actual` no backend/front; `Perfil.tsx` usa `/user/me`, com nome/email/tipo apenas de leitura e formulário só para a alteração de senha (senha actual + nova + confirmação; `changePassword` no serviço).

#### Como está agora
- `Perfil.tsx` chama `utilizadoresService.get(user.id)` → `GET /user/:id` é **só admin** → para professor/técnico/etc. o request cai em 403 (304 no front, `loading` termina sem dados) — **nome/email/tipo não são exibidos** para não-admin.
- Formulário permite alterar `nome` e `novaSenha` (sem exigir a senha actual); `PUT /user/:id` não-admin permite `nome`/`senha` sem validação da senha corrente.

#### O problema
- Bug de não-admin (perfil vazio + queda da tela ao carregar).
- Sem senha actual, qualquer utilizador com sessão de outro (ex.: sessão deixada aberta) troca a senha.

#### Como deve ficar
- `GET /user/me` (autenticado) devolve o próprio utilizador → usado no `Perfil`.
- Campos nome/email/tipo **só de leitura** (já visíveis no header); formulário de edição contém **apenas a alteração de senha**.
- Alterar senha exige `senha_actual` (verificada com argon2) + `nova_senha` + confirmação no front.

#### Que alterações fazer
1. Backend: `GET /user/me` (authRequired; sem RBAC — devolve `req.user` completo) em `utilizadores.routes.js` (antes de `/:id`).
2. `PUT /user/:id` (não-admin e self): ao receber `senha`, exigir `senha_actual` e verificar com `verifySenha`; senha actual errada → 400/401 `Senha actual incorrecta`.
3. `Perfil.tsx`: usar `GET /user/me`; formato de senha só: campo **Senha actual** + **Nova senha** + **Confirmar**; remover input de "Nome"; email/cargo em badges read-only.
4. `utilizadores.service.ts`: `me()`; `changePassword` com `senha_actual`.

### 2.13. Validação de formulários (erros em tempo-real; numéricos sem negativos/letras)

> **Estado:** parcial ✅ (E1) — novo `NumberInput` (filtra `-`, `.`, `e`, `+`, `sanitizeNumber`; `allowNegative`/`allowDecimal`) aplicado em `ActividadeUpsertModal`, `MaterialUpsertModal`, `EstudanteUpsertModal`, `HistoricoMaterialUpsertModal`, `RelatorioUpsertModal`. Pendente: padrão de erros por campo em tempo-real (item 2).

#### Como está agora
- Validação sobretudo no **submit** (`getStepError` por passo no `ActividadeUpsertModal`); erros por campo em tempo-real só parcial (blocos de agendamento).
- Inputs numéricos passaram a `NumberInput` (já não aceitam `-1`, `e`, `+`, `.` indesejados) nos modais acima; restantes pontos de formulário sem erros por campo.

#### O problema
- UX pobre (erros só após tentar avançar) e dados inválidos entram silenciosamente (valores negativos de stock/participantes).

#### Como deve ficar
- Erros por campo visíveis **antes do submit** (onBlur/onChange, luz lateral) em todos os modais.
- Componente `NumberField`/mascara: numéricos apenas dígitos ≥ 0 (bloquear `-`, `.`, `e`, `+` via `onKeyDown`/`beforeinput` e sanitizar no `onChange`); `min>=0` por defeito, `min>=1` onde aplicável.

#### Que alterações fazer
1. Novo `components/ui/number-input.tsx` (`NumberInput`) — wrapper de `Input` que filtra `/[^\d]/` (ou `-`/`.`/`e`/`+`) e expõe `value: string`. Substituir em `ActividadeUpsertModal` (participantes, nº turma, qtd estimada), `MaterialUpsertModal` (mínima, stock inicial), `HistoricoMaterialUpsertModal` (quantidade).
2. Padrão de erros por campo: componente `FieldError`/`FormField` (Label + Input + `p` erro) e validações derivadas por estado (ex.: turno obrigatório para aula, email com regex, datas fin≥ini, hora_fim>hora_inicio). Ligar nos `*UpsertModal` (começar pelos mais usados: Actividade, Material, Estudante, Utilizador, Curso).
3. Resolver diferenças de `getStepError` com `onBlur` para mostrar o erro mas deixar prosseguir só se válido.

---

## 3. TELA DE CONFIGURAÇÃO DO SISTEMA (fluxo de aprovação configurável)

> **Estado:** ✅ (E0 backend + E2 front) — `FluxoAprovacao` + `GET/PUT /configuracao/fluxo` + `/reset`, fila config-driven; `Configuracao.tsx` em `/configuracao` (A) com tabs "Fluxo de Aprovação" (reordenação up/down, nomes editáveis, checkboxes de cargos, guardar + repor padrão) e "Catálogos" (CRUD de unidades laboratoriais, categorias de material e unidades de medida).

### Como está agora
O fluxo DLab → Supervisor está **hardcoded**: `AprovacaoEtapa {dlab, supervisor}`, RBAC por etapa em `aprovacoes.routes.js` (`coordenador_dlab`/`supervisor`), `ActividadeEstado` com dois marcadores fixos. Não existe tela nem dados de configuração.

### O problema
- Trocar cargos, adicionar etapas ou mudar a ordem exige alteração de código + schema; a fila actual não configura quem aprova quando.

### Como deve ficar
- Modelo `fluxo_aprovacao`: tabela de etapas ordenadas:
  ```
  FluxoAprovacao {
    id, ordem Int,
    cargo UtilizadorTipo,          // ou novo enum "cargo" reutilizando UtilizadorTipo
    nome String,                   // ex.: "Validação DLab"
    descricao String?,
    marcador_estado String?,       // ex.: "revisado_dlab" (output da etapa)
    activo Boolean,
    criado_em, actualizado_em
    @@unique([ordem, cargo])
  }
  ```
- A aprovação de atividade segue a **ordem de `ordem` asc**; **a mais antiga primeiro** é obrigatória (não pode haver desempate por outra ordem).
- Tela `/configuracao` (Admin): CRUD das etapas (cargo, ordem, nome, activo), com aviso de que alterações afectam processos em curso (agendamentos já em `aprovado_*` mantêm a etapa actual até concluírem).
- Backend: a fila (`GET /aprovacoes`) e os validadores de etapa deixam de usar literais `dlab`/`supervisor` e passam a ler o `fluxo_aprovacao` activo.

### Que alterações fazer
1. Schema: `FluxoAprovacao` + seed (etapas 1=DLab `coordenador_dlab`, 2=Supervisor `supervisor`) — mantém compatibilidade com o default actual.
2. Módulo `configuracao.routes.js`: `GET /configuracao/fluxo` (A,C,S) e `PUT/POST/DELETE /configuracao/fluxo/:id` (A). Garantir `ordem` única e que nenhuma edição cria duas etapas com a mesma ordem.
3. `aprovacoes.routes.js`: substituir as sequências fixas por leitura do fluxo (`ordem`); guardar `fluxo_etapa_id`/`ordem` na `Aprovacao` para histórico estável; marcar aprovações antigas com a etapa do momento (backfill).
4. `ActividadeEstado`/marcador: o marcador `revisado_*` passa a ser por-ordem (ex.: derivado `etapa_actual_id`); Estados legados continuam a ser lidos.
5. Front: `pages/configuracao/Configuracao.tsx` (tabs: "Fluxo de Aprovação", futuras "Catalogos") com `Table` + `ConfirmDialog` + reordenação (up/down). Adicionar rota `/configuracao` (A) e item no `Sidebar` (secção Administração).
6. Topbar/Sidebar: adicionar ícone/rota para admin ver a configuração.

---

## 4. AMBIENTES (dev / teste-staging)

### Como está agora
- **✅ [E3 — completo]** Provider `postgresql` único; `db.js` com `@prisma/adapter-pg` (PrismaPg); Neon ligado (pooled + `directUrl`) com migração `init` versionada aplicada e seed corrido; `api/index.js` + `vercel.json` (função Vercel + SPA fallback + `vercel-build`); `server/package.json` com deps backend (workspace npm); `.env.example` Postgres/Neon; scripts `npm run deploy` (migrate+generate+`vercel deploy --prod`) e `npm run dev` (server+vite). Projeto **dlab** na Vercel com `DATABASE_URL`/`DIRECT_URL` em Production+Preview; **deploy live** → https://dlab-gray.vercel.app.
- **🔴 [E3 — opcional]** CI (GitHub Actions) **não configurado**; deploy é manual via `npm run deploy`.

### O problema
- Neon é **Postgres** e o Vercel é **serverless** (funções efêmeras, sem processo de longa duração). O backend actual (Express + adapter MariaDB + `node` ESM clássico) **não funciona tal qual na Vercel**.
- Prisma v7 não permite trocar `provider` (mysql↔postgresql) no mesmo `schema.prisma` numa única geração — o cliente é gerado com o adapter correspondente ao provider. Manter dois schemas = dupla manutenção e risco de drift.

### Análise de opções (decisão confirmada: staging é Neon + Vercel)
| Opção | Prós | Contras |
|---|---|---|
| **A — Schema único Postgres em todos os ambientes** (recomendado) | Um só schema/client; dev local igual a staging; Prisma migra de enums/`@@map` sem fricção; Neon tem pooling + serverless driver nativo; Vercel integrado | Perde-se MySQL; requer ajuste de queries raras (datas/tipos) no arranque |
| B — MySQL dev + Postgres staging (2 schemas) | Dev "como hoje" | Dupla manutenção; drift inevitável; Prisma gera clientes diferentes |
| C — Manter MySQL + deploy Express em VM/container | Menos mudança | **NÃO cumpre o requisito** (staging seria Vercel); neon descartado |

**Escolha: Opção A.** Dev local usa **Postgres 16 (Docker) ou branch dev da Neon**; o provider passa a `postgresql`; staging usa **Neon** (pool) + **Vercel**.

### Como deve ficar
- `.env` (raiz) passa a ter `DATABASE_URL=postgresql://...`; `prisma.config.ts` aponta o schema; adapter muda de `@prisma/adapter-mariadb` para `@prisma/adapter-pg` (dev) e `@prisma/adapter-neon` (staging) — ou só `adapter-pg` com URL da Neon via pooler.
- Backend deixa de ser "servidor sempre-ligado": exporta a app Express como **função Vercel** (`api/index.js` → `@vercel/node`), sem `app.listen` em produção, mantendo `npm run dev:server` local.
- Migrações versionadas (`prisma migrate dev`) no lugar de `db push` destrutivo.
- Config separada por ambiente: `VITE_API_URL` / `REWRITE` no `vercel.json` faz `/_api/* → /api/*` (ou `api/index.js` servindo `/api/*`).

### Que alterações fazer
1. `server/prisma/schema.prisma`: `provider = "postgresql"`; rever tipos específicos (`@db.LongText` → `@db.Text`, enums MySQL são ok em Postgres via Prisma). — ✅ feito
2. `server/src/db.js`: trocar `PrismaMariaDb` por `PrismaPg` (dev) / `PrismaNeon` (staging), lendo provider da URL. — ✅ feito (`PrismaPg` único; URL Neon pooled via adapter-pg)
3. `server/package.json`: mover deps para `server/` (devDependencies + dependencies próprias) para satisfazer o build da Vercel; scripts `dev`/`start` e `vercel-build`. — ✅ feito (workspace `server`; install via raiz)
4. `api/index.js` (raiz): `import app from '../server/src/app.js'; export default app;` + `vercel.json` (`builds`/`routes` apontando a função; `rewrites` para o front). O `app.js` deve não executar `listen` quando importado. — ✅ feito (strips `/api` prefix; app.js já só exporta)
5. Migrações: `prisma migrate dev --name init` após tocar o provider; remover dependência de `db setup` destrutivo nos deployments (CI roda `prisma migrate deploy`). — ✅ feito (migração `init` aplicada e marcada; `migrate:deploy` no script)
6. Neon: criar projecto; ligação via **pooled connection string** (`neon.tech` -> `-pooler.postgres.vercel-storage.com` ou endpoint do Neon; usar `directUrl` para migrações e `url` + pooler para runtime). — ✅ feito (`DATABASE_URL` pooled + `DIRECT_URL` em `.env` e na Vercel, Production+Preview)
7. Variáveis por ambiente: `.env.development` / `.env.staging` documentadas em `.env.example`; `VITE_API_URL` para o front apontar à função da Vercel em staging (proxy `/api` mantido em dev). — 🟡 `.env.example` atualizado (inclui VERCEL_* para CI); sem alias/`.env.*` de domínio custom
8. `vite.config.ts`: manter proxy em dev; `base` e build optimizados para Vercel. — ✅ proxy mantido; `base` root OK
9. Seed: `server/scripts/seed-db.js` continua a funcionar em Postgres (verificar tipagem das datas/matrículas); executar em staging uma vez. — ✅ corrido no Neon
10. CI (GitHub Actions opcional): `prisma generate` + `prisma migrate deploy` + `vercel deploy --prebuilt`. — 🔴 opcional, não configurado (deploy manual via `npm run deploy`).

---

## 5. AUDITORIA FINAL — INCONSISTÊNCIAS ENCONTRADAS

### 5.1. Segurança
1. **[Crítico]** `window.prompt` para reposição de senha (`UtilizadoresList.tsx:59`) — divulga fluxo de reset sem modal próprio; substituir (§2.3).
2. **[Alto]** Sem validação de senha actual ao alterar a própria senha (`PUT /user/:id`) — sessão deixa trocar a senha sem reautenticação (§2.12).
3. **[Alto]** Perfil não-admin: `GET /user/:id` é admin-only → não-admin fica sem perfil (availability bug + 403 inesperado) (§2.12).
4. **[Médio]** Sem `helmet` (headers de segurança) e sem `express-rate-limit` no `/user/login` (brute force). — ✅ **[E4]**: `helmet` + `express-rate-limit` (global 300/15min, login 20/15min).
5. **[Médio]** CORS aberto (`cors()` sem whitelist) — em produção, qualquer origem fala com a API se o token vazar. — ✅ **[E4]**: whitelist `localhost` + `*.vercel.app` + `CORS_ORIGINS` (env); pedidos sem Origin aceites.
6. **[Médio]** JWT sem refresh tokens/revogação; logout apenas client-side.
7. **[Médio]** `JWT_SECRET` com fallback hardcoded (`dlab-dev-secret-change-in-production`) — forçar via env em produção, sem default.
8. **[Baixo/Médio]** Upload de documento não existe (multer 🔴) — `anexo_path` aceita qualquer string/URL; sem sanitização de path.
9. **[Baixo]** erros lançam `err.message` ao cliente (500) — fuga de detalhes internos.
10. **[Baixo]** Email: criação exige `@isptec.co.ao` mas seeds usam `@isptec.pt` (inconsistência a alinhar). — ✅ seed actualizado para `@isptec.co.ao`.

### 5.2. Funcionalidade (bugs/desvios)
1. **[Alto]** `finalizar` Supervisor bloqueia com agendamentos `pendente` — comportamento contrário ao desejado (§2.11).
2. **[Alto]** Perfil não-admin sem dados (bug de consumo, §2.12).
3. **[Médio]** Histórico de aprovações com comentário repetido por agendamento e sem agendamentos afectados (§2.10).
4. **[Médio]** `GET /disciplinas/:id` e `PUT /curso-disciplinas/:id` ausentes (spec original tinha).
5. **[Médio]** Relatórios: PDF mínimo com raw JSON (`buildMinimalPdf`, 3000 chars) — sem pdfkit.
6. **[Médio]** Sem relatório automático mensal nem alertas de stock real (cron/socket), `NotificacoesContext` usa mocks.
7. **[Baixo]** `mockData.ts` morto; `server/seed.js`, `server/data/*`, `config.js/DATA_FILE` legado não consumidos (§4). — ✅ **[E4]** removidos (ficheiros + `DATA_FILE` do `config.js`).
8. **[Baixo]** `scripts/migrate-json.js` desactualizado (usa `utilizador_id`, sem `Agendamento.estado`, sem `Aprovacao.agendamento_id`).
9. **[Baixo]** Calendário começa fixo em Jun/2026 e sem "Hoje"/visões (§2.7).
10. **[Baixo]** Listagens sem filtros/paginação (Labs, Cursos, Disciplinas, Aprovações, Relatórios) (§2.2).
11. **[Baixo]** `AprovacaoDetalhe`/`ActividadeDetalhe` saturadas; falta tabs (§2.8/2.9).
12. **[Baixo]** Sem detalhe de estudante e sem detalhe de curso (§2.4/2.5).

### 5.3. Padronização (código/UI/UX)
1. **[Médio]** Selects sem pesquisa em vários modais; catalogs hardcoded (enums) — deve usar `SearchSelect` com CRUD + "criar na hora" (§2.1).
2. **[Médio]** Padrão de listagem inconsistente (nem todas usam `FiltersBar`+`SimplePagination`) (§2.2).
3. **[Médio]** `window.prompt` viola a norma "nunca usar confirm/alert/prompt nativos" (§2.3).
4. **[Médio]** Validação só no submit; `type=number` aceita `-1`/`e` (§2.13).
5. **[Baixo]** `@tanstack/react-query`, `zustand`, `react-hook-form`(parcial), `@tanstack/react-table`, `react-day-picker` instalados mas sem uso — peso morto no bundle. — ✅ **[E4]** removidos `react-query`/`zustand`/`react-table`/`@supabase/supabase-js`/`zod`/`@hookform/resolvers`; `react-hook-form` (usado em `ui/form`) e `react-day-picker` (usado em `ui/calendar`) mantidos.
6. **[Baixo]** Tabelas manuais em vez de `react-table`; paginação `pagination.tsx` não usada (usar `simple-pagination`). — 🟡 **[E4]** `react-table` desinstalado (tabelas manuais mantidas); `pagination.tsx` continua não usado (usar `simple-pagination`).
7. **[Baixo]** Front `enums.ts` diverge de labels AGENTS.md só no nome dos estados — já alinhado nesta revisão.
8. **[Baixo]** `server/` sem package.json de deps (tudo na raiz) — complica deploy da Vercel (§4). — ✅ **[E3]** workspace `server` com deps próprias.
9. **[Baixo]** Sem migrations versionadas (`db push` destrutivo) (§4). — ✅ **[E3]** migração `init` versionada; `migrate:deploy` no `npm run deploy`.
10. **[Baixo]** Sem hooks de domínio (`src/hooks/` só `use-toast`) e pages com `useState`+`useEffect` repetido — padronizar com hooks/service.

---

## 6. ORDEM DE IMPLEMENTAÇÃO SUGERIDA (épicos)

1. **E0 — Fundações backend**: migração DB (`db.push`/`migrate`), catalogs CRUD + backfill (§2.1), `FluxoAprovacao`/configuração (§3), modelo lote `AprovacaoAgendamento` (§2.8/2.10), `GET /user/me` + `senha_actual` (§2.12), pendentes-avançam (§2.11), `GET /estudantes/:id/actividades` (§2.4). (**✅ concluído** — validado por smoke tests; pendente: `prisma migrate` versionado, em E3.)
2. **E1 — Componentes partilhados**: `SearchSelect` (§2.1), `NumberInput` + erros por campo (§2.13), `ResetPasswordModal` (§2.3), `FiltersBar`/`SimplePagination` em todas as listas (§2.2). (**✅ concluído** — pendente do §2.13: erros por campo em tempo-real, e do §2.2: ordenação explícita na fila, remetidos para E2.)
3. **E2 — Telas novas/refactor**: `EstudanteDetalhe` (§2.4), `CursoDetalhe` + simplificação de Disciplinas (§2.5), calendário 3 visões + "Hoje" + filtros `de`/`ate` no backend (§2.7), tabs Aprovação + decisão em massa (§2.8), tabs Atividade + histórico por lote (§2.9/2.10), Perfil (§2.12), Configuração (§3). (**✅ concluído** — pendente remetido para front futuro: tabs Lab (§2.6), erros por campo em tempo-real (§2.13), ordenação explícita na fila (§2.2/2.6).)
4. **E3 — Ambientes**: provider Postgres + adapters + Vercel function + Neon + CI (§4). (**✅ concluído** — Neon ligado + migração `init` + seed; projecto Vercel `dlab` com `DATABASE_URL`/`DIRECT_URL` (Production+Preview); deploy live https://dlab-gray.vercel.app; scripts `deploy`/`dev`. Pendente opcional: CI GitHub Actions.)
5. **E4 — Hardening/auditoria**: helmet/rate-limit/CORS whitelist, remoção de código morto, PDF real, notificações socket/cron (opcional). (**✅ concluído o bloco principal** — helmet + express-rate-limit + CORS whitelist por env; removidos `mockData.ts`/`seed.js` legados/`server/data`/`DATA_FILE` e deps não usadas (`react-query`, `react-table`, `zustand`, `supabase`, `zod`, `resolvers`); **lint a 0 erros** (16 corrigidos; 17 warnings documentados: `exhaustive-deps`×9, `only-export-components`×8). **Pendentes:** ❌/🔴 PDF real via pdfkit (§6 RF19), notificações socket/cron reais (§5 RF14/RF18), CI GitHub Actions, 17 warnings de lint.)