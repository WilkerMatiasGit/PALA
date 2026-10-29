# PLANO — DLab (Roteiro de Implementação Evolucionária)

> Documento vivo: cada item implementado deve ser movido para o estado "✅ implementado"
> no `AGENTS.md`. As alterações abaixo seguem o formato **Como está agora / O problema /
> Como deve ficar / Que alterações fazer**. O capítulo 5 contém a auditoria final com
> todas as inconsistências (segurança, funcionalidade, padronização).

## 0. DECISÕES DE ARQUITECTURA TOMADAS (consenso)

> **Modelo de agendamentos independentes — IMPLEMENTADO** (ver §0.1). As decisões 1, 2, 3 e 7
> abaixo foram **substituídas** pelo modelo descrito em §0.1 e mantêm-se aqui apenas como
> registo histórico do que foi pendente durante as iterações anteriores.

1. ~~**Estado da atividade**: mantêm-se `revisado_dlab`/`revisado_supervisor` (marcadores de etapa).~~ **Substituído** por `pendente`|`em_andamento` (§0.1).
2. ~~**Modelo de aprovação**: permanece **por agendamento** (votos individuais + conclusão de etapa).~~ **Substituído**: por agendamento mas **sem conclusão de etapa** (§0.1).
3. ~~**Pendentes não bloqueiam avanço**:~~ **Obsoleto** — sem conclusão de etapa, os agendamentos `pendente` simplesmente permanecem na fila da etapa seguinte (§0.1).
4. **Enums → CRUD**: convertidos apenas `UnidadeLaboratorial` (tipo de lab) e `CategoriaMaterial`. Os restantes enums (estado de material, motivo de movimentação, departamento, cargos, tipos de atividade/papel/turno) **ficam como enums fixos** — ver análise em §2.1.
5. **Unidade do material**: passa a CRUD **global** (`unidades`), migrando os valores existentes (`ml`, `un`, `g`).
6. **Neon + Vercel**: análise concluída em §4 — **schema único Postgres** em todos os ambientes (dev local = Postgres via Docker ou Neon dev branch; staging = Neon + Vercel). MySQL deixa de ser o dev base.
7. ~~**Histórico de aprovação**: agrupamento **por lote** com `aprovacao_agendamentos`.~~ **Substituído**: `DecisaoAgendamento` com **uma linha por agendamento**, sem tabela de ligação (§0.1).
8. **Entregável**: este `PLANO.md` + `AGENTS.md` actualizado.

### 0.1. Modelo de agendamentos independentes (✅ implementado)

Decisão que substitui os pontos 1, 2, 3 e 7 acima:

1. **Decisão por agendamento, imutável**: `DecisaoAgendamento` (`agendamento_id`, `decisor_id`, `etapa`, `decisao`, `comentario?`, `criado_em`) é um log **append-only**. Não existe rollback, conclusão de etapa nem soft delete de decisões.
2. **Estado da atividade derivado das sessões**: `ActividadeEstado { pendente, em_andamento, rejeitada, realizada }`. Passa a `em_andamento` quando existe a **primeira** decisão de um agendamento da atividade. "Deixar pendente" **não** conta como decisão. `rejeitada` = todas as sessões `rejeitado`; `realizada` = todas concluídas e ≥1 `realizado` — derivação central em `recalcularEstadoActividade` (✅ E6).
3. **Fila por estado do agendamento**: `dlab` vota em `nao_revisto`; `supervisor` vota em `aprovado_dlab` **e** `pendente` (o que ficou pendente no DLab avança para o Supervisor). Um agendamento pode estar em **duas etapas activas ao mesmo tempo**, cada uma com a sua decisão.
4. **`num_participantes` desce para `Agendamento`** (obrigatório, `>= 1`), com backfill a partir do valor que estava em `Actividade`. Sessões diferentes da mesma atividade podem ter públicos diferentes.
5. **`HistoricoMaterial.agendamento_id`** (nullable) substitui `actividade_id`: o consumo passa a ser atribuído à **sessão** que o originou, e não à atividade inteira.
6. **Atribuição de técnicos por sessão** (✅ E6): o par **validador+assistente** é obrigatório na aprovação do Supervisor (modal no `AprovacaoDetalhe`) e gravado atomicamente em `agendamento_tecnico` (substitui `actividade_tecnico` e `precisa_assistente`). Correcção de sessões aprovadas antigas sem técnicos via `POST /agendamentos/:id/tecnicos` (Admin/Supervisor).
7. **Edição de atividade recria os agendamentos**: `PUT /actividades/:id/full` desactiva as sessões activas (`activo=false`, preserva as decisões antigas como histórico) e **recria** novas sessões em `nao_revisto`, logo o fluxo de aprovação volta ao início. Só é permitido (✅ E9) ao **responsável/Admin** e **enquanto nenhuma sessão activa tiver decisão** (ver §2.14). O front carrega as sessões existentes antes de submeter para não as perder por omissão.
8. **Materiais por sessão** (✅ E7): `AgendamentoMaterial` (`agendamento_id`, `material_id`, `@@unique [agendamento_id, material_id]`) substitui `ActividadeMaterial` — as materiais pedidos passam a ser **por sessão** (relação com `agendamentos`, não com `actividades`); `PUT/atividades/:id/full` recebe-os em `agendamentos[].materiais[]`; a validação de stock agrega a quantidade por material em todos os agendamentos da submissão; removido o endpoint standalone `POST/DELETE /actividade-materiais`. Aplicada com recriação da tabela via `db push --force-reset` (sem migração data-preserving; base re-semeada).
9. **[A AVALIAR — não implementado] Materiais reutilizáveis / vidraria**: a baixa automática de stock (RF14) desconta todos os `AgendamentoMaterial` da sessão, incluindo itens reutilizáveis (ex.: `vidraria`) que na prática são devolvidos e não consumidos. Decisão actual: **apenas documentar** (ver AGENTS.md §5). Qualquer solução (flag `reutilizavel` na categoria e/ou movimento de devolução) fica por avaliar com feedback real.

Migração data-preserving aplicada ao Neon em `20260926090000_agendamento_independente`
(collapsed dos estados legados em `pendente` antes da troca de enum, backfill das decisões a
partir de `aprovacoes`/`aprovacao_agendamentos` e do histórico de consumo).

---

## 2. ALTERAÇÕES PLANEADAS

### 2.1. Estrutura e CRUDs (unidade laboratorial, categorias, unidade, enums, SearchSelect)

> **Estado:** ✅ (E0 backend + E1 front) — modelos + CRUD `/unidades-laboratoriais`, `/categorias-material`, `/unidades` + `utils/catalogos.js`; `Laboratorio.unidade_laboratorial_id`, `Material.categoria_id`/`unidade_id`; front: `SearchSelect` (Pesquisa + "Criar na hora") aplicado em `MaterialUpsertModal`/`LaboratorioUpsertModal`, displays migrados para `catalogoLabel(...)`. **Correcção (soft delete):** o `POST` dos catálogos reactiva um registo `!activo` com o mesmo nome (200) em vez de colidir; `DELETE` em uso responde 409 com mensagem específica; erros do `SearchSelect`/`catalogos.service.ts` usam `apiErrorMessage`; `unidadeId()` reactiva no fallback (evita P2002).

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
- `AprovacoesList` ordena pelo que vem do backend (`GET /aprovacoes` ordena por `criado_em` desc — mais recente primeiro) — sem filtro explícito nem controlo de ordenação no UI.

#### O problema
- Listas de laboratórios/cursos/disciplinas/aprovações/relatórios ficam insustentáveis com volume; quebra o padrão visual das restantes.
- Aprovações deveriam ter uma ordem clara na fila (**mais recentes primeiro** — decisão actual, substitui a intenção original de "ordem de chegada") e filtros por estado/etapa/laboratório.

#### Como deve ficar
- Todas as listagens têm `PageHeader` + `FiltersBar` + `Table` + `SimplePagination` (client-side, `PAGE_SIZE=10`), mesmo recorte visual.
- `AprovacoesList`: filtros por nome, etapa, laboratório. A fila vem ordenada por `criado_em desc` (mais recentes primeiro) — decisão actual do utilizador, substitui a antiga "ordem de chegada (mais antigo primeiro)".

#### Que alterações fazer
1. `LaboratoriosList`: filtro `nome` (texto) + paginação; ação de chevron para `/labs/:id` já existente.
2. `CursosList`: filtro por nome + departamento (enum fixo) + paginação.
3. `DisciplinasList`: após §2.5 fica só o CRUD de disciplinas; adicionar filtro `nome` + paginação.
4. `AprovacoesList`: adicionar `FiltersBar` (nome, etapa, laboratório — buscar labs via `laboratoriosService.list()`) + `SimplePagination`. Ordenação por `criado_em desc` (mais recentes primeiro) — ✅ aplicada no backend (`GET /aprovacoes`); o front não reordena.
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

> **Estado:** ✅ (E0 backend + E2/E6/E7 front) — `POST /aprovacoes/lote`; `AprovacaoDetalhe.tsx` com Tabs **Agendamentos** (cards por sessão + decisão em massa) e **Decisões**, modal de técnicos (validador+assistente) ao aprovar no Supervisor, lote só rejeitar no Supervisor (aprovou individual com técnicos). Os **materiais pedidos aparecem dentro de cada card de agendamento, colapsados por defeito** (sem tab «Materiais»). Botão «Rejeitar atividade» **sempre visível e habilitado só sob regra do servidor** (`GET /aprovacoes/:id.pode_rejeitar_atividade`): bloqueia se houver sessão `realizado`/`aprovado_supervisor` ou todas `rejeitado`; habilita se todas as não-rejeitadas estiverem na mesma etapa e o utilizador puder votar nessa etapa (`FluxoAprovacao`; admin sempre). **Aprovar e Deixar pendente (DLab) marcam no card** («Alterar decisão»/«Concluir» persistem); **Rejeitar (qualquer etapa) e Aprovar no Supervisor gravam de imediato no modal** (justificação no modal; fechar sem confirmar = nada feito).
> ⚠️ **Substituído por §0.1:** a decisão em lote já **não** cria `AprovacaoAgendamento`; grava uma `DecisaoAgendamento` por agendamento e **não** leva `etapa` (deduzida por agendamento). Não implementar a secção "Aprovacao + ligações" abaixo.

#### Como está agora
- `AprovacaoDetalhe` (rota `/aprovacoes/:id`) = cards: Dados da Actividade/header, Agendamentos (votação por sessão com técnicos), Decisão em massa.
- Cada agendamento tem botões Aprovar/Rejeitar/Deixar pendente: **Aprovar e Deixar pendente** marcam no card («Alterar decisão»/«Concluir» persistem; só DLab); **Rejeitar em qualquer etapa** grava de imediato no modal de justificação.
- Aprovar no Supervisor abre modal obrigatório com `validador_id` + `assistente_id` (mesma pessoa permitida; `tipo='tecnico'`).
- Comentário **único partilhado pelo lote**: limitação conhecida (os agendamentos de um lote podem ter motivos de rejeição diferentes entre si). Decidido **não mexer** por agora — melhoria futura possível: expandir e personalizar o comentário por agendamento dentro do lote, **colapsado por defeito**; avaliar consoante feedback de uso real.
- Botão «Rejeitar Atividade» **sempre visível**; estado lido de `GET /aprovacoes/:id.pode_rejeitar_atividade` (calculado no servidor). Usa **uma única label genérica** para os 5 casos de bloqueio (`realizado`, avançou para `aprovado_supervisor`, todas `rejeitado`, etapas mistas, sem permissão na etapa) e uma label própria quando a atividade não tem agendamentos. **Melhoria futura (não implementar agora):** o backend devolver um `motivo_bloqueio` (enum) em vez de só `pode_rejeitar_atividade` (booleano), para o front mostrar uma mensagem específica por caso.

#### O problema
- Sem tabs, a tela satura com várias actividades; decidir "data a data" é lento.
- Cada decisão gera uma `Aprovacao` por agendamento (comentário repetido).

#### Como deve ficar
- Ordem: **Agendamentos** (votação) primeiro, **Decisão em massa** depois — "Dados da Actividade" fica como card.
- **Decisão em massa**: checkbox multiselect dos agendamentos votáveis + decisão única (comentário obrigatório ao rejeitar; no Supervisor **só rejeitar** — aprovar exige técnicos e é individual).

#### Que alterações fazer
1. Backend (`aprovacoes.routes.js`): novo `POST /aprovacoes/lote` com body `{ agendamento_ids: [], etapa, decisao, comentario? }` — numa transação: valida sequência/estado de cada agendamento, actualiza estados e cria **uma** `Aprovacao` + ligações `aprovacao_agendamentos` (novo model). `delete`/`rollback` do lote reverte todos.
2. Schema: novo model `AprovacaoAgendamento` (`aprovação_id`, `agendamento_id`, `@@unique([aprovacao_id, agendamento_id])`); `Aprovacao.agendamento_id` passa a legado/opcional (manter por compatibilidade ou migrar).
3. `AprovacaoDetalhe`: reestruturar com `Tabs`; painel de votação com selecção múltipla e botão aplicar decisão.
4. Service `aprovacoes.service.ts`: `createLote(data)` + ajustar `listByActividade` para devolver agendamentos por aprovação.

### 2.9. Detalhe da atividade (cards → tabs)

> **Estado:** ✅ (E2/E6/E7) — `ActividadeDetalhe.tsx` com Tabs Geral/Agendamentos/Documento/Histórico; header com nome/tipo/estado + laboratório; "Geral" agrupa informação + detalhes do tipo; técnicos por sessão no tab Agendamentos (validador/assistente + confirmações) e a **lista de materiais solicitados dentro do card de cada agendamento** (a antiga tab «Materiais» foi removida).

#### Como está agora
- `ActividadeDetalhe` = cards (Informação Geral, Detalhes, Agendamentos, Materiais, Documento, Histórico de Aprovações) em Tabs; REMOVIDO o card "Técnico & Assistente" (E6) — os técnicos vêm por sessão em Agendamentos.

#### O problema
- Empilhamento pesado; "Informação Geral" + "Detalhe" repetem informação e podem ficar juntos.

#### Como deve ficar
- Header (nome, tipo, estado, laboratório) e `Tabs`:
  - **Geral** = "Informação geral" + "Detalhe (tipo)";
  - **Agendamentos** (com técnicos da sessão, confirmações professor/técnico e os materiais pedidos por sessão);
  - **Documento** (só projecto/estágio);
  - **Histórico de Aprovações** (ver §2.10).

#### Que alterações fazer
1. `ActividadeDetalhe.tsx`: refactor em `Tabs`; agrupar os 3 painéis pretendidos no painel "Geral".
2. Mover "Histórico de Aprovações" para um card/tab com lista por lote (ver §2.10).

### 2.10. Histórico de aprovação (agrupamento por lote, comentário único, agendamentos afectados)

> **Estado:** ✅ (E5 — substituído por §0.1) — histórico **sem agrupamento por lote**: `GET /actividades/:id/decisoes` devolve uma `DecisaoAgendamento` por agendamento, com `decisor_nome`, `agendamento_nome` e `h_inicio`/`h_fim`; a tab "Histórico" lista essas linhas. Decisões em lote gravam o **mesmo comentário em cada linha** (não há linha de lote partilhada).
> ⚠️ **Substituído por §0.1:** não agrupar por lote, não introduzir `aprovacao_agendamentos`, não voltar a `GET /actividades/:id/aprovacoes`. O resto desta secção é histórico.

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

> **Estado:** ✅ resolvido, mas **por outra via** (§0.1) — o `finalizar` deixou de existir; os agendamentos `pendente` avançam simplesmente porque o Supervisor passa a vê-los na fila (`aprovado_dlab`+`pendente`) e a atividade deixou de ter marcador de etapa (`pendente|em_andamento`).
> ⚠️ **Substituído por §0.1:** não reintroduzir `POST /aprovacoes/:id/finalizar` nem `ActividadeEstado` com marcadores de etapa. O resto desta secção é histórico.

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

> **Estado:** parcial ✅ (E1/E7) — novo `NumberInput` (filtra `-`, `.`, `e`, `+`, `sanitizeNumber`; `allowNegative`/`allowDecimal`; e **`min`/`max` aplicados em tempo-real** via `clampNumber` — ex.: quantidade estimada de material com `min={1}`, impedindo fisicamente digitar 0/negativo) aplicado em `ActividadeUpsertModal`, `MaterialUpsertModal`, `EstudanteUpsertModal`, `HistoricoMaterialUpsertModal`, `RelatorioUpsertModal`. Pendente: padrão de erros por campo em tempo-real (item 2).

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

### 2.14. Política de edição/apagamento de atividade e sessões (✅ E9)

> **Estado:** ✅ implementado (E9) — **sem migração**. Centraliza a decisão de *quem**, *quando* e **que campos** podem ser alterados numa atividade e nas suas sessões, e documenta explicitamente o comportamento do `PUT /actividades/:id/full`.

#### Regras (RF08c/08d — ver AGENTS.md §1)
- **Quem:** só o **responsável** (`actividades.responsavel_id`) ou o **Admin**.
2. **Quando:** apenas enquanto **nenhuma sessão activa (`activo:true`) tiver decisão registada** (`nao_revisto`/`pendente`). "Deixar pendente" **não** é decisão. `aprovado_dlab`/`aprovado_supervisor`/`rejeitado`/`realizado` bloqueiam. Atividade `rejeitada` **nunca** é editável/apagável. A verificação é feita **dentro da transação** que grava.
3. **Campos bloqueados** (todos, incluindo Admin): `tipo` e `laboratorio_id` são imutáveis (aceita só o valor actual; 400 se diferir). `responsavel_id` só o Admin altera (não-Admin: 400 se divergir, aceita se igual).
4. **Códigos:** 403 (não é responsável/Admin) · 409 (já tem decisões, ou `rejeitada`) · 400 (campo bloqueado / lista de sessões vazia).
5. Aplica-se a `PUT/DELETE /actividades/:id`, `PUT /actividades/:id/full`, `POST /agendamentos`, `PUT/DELETE /agendamentos/:id` e aos upserts `POST /aulas|visitas|projectos|estagios`. `PUT /projectos|estagios/:id/documento` fica **fora** (entrega de documento pós-aprovação).
6. `DELETE /agendamentos/:id` **bloqueia (409)** remover a última sessão activa e recalcula o estado da atividade após o delete.

**`PUT /actividades/:id/full` recria as sessões:** a edição atómica **desactiva** todas as sessões activas da atividade (`activo=false` — preserva as decisões antigas como histórico) e **cria novas** sessões em `nao_revisto`. É seguro precisamente porque a regra 2 garante que nenhuma sessão activa tinha decisão; o efeito prático é que **editar uma atividade repõe o fluxo de aprovação do zero**. `POST /actividades/full` e `PUT /actividades/:id/full` rejeitam uma lista de agendamentos **vazia** (400).

#### Implementação
- Backend: `server/src/utils/actividade_permissao.js` (`avaliarAlteracaoActividade`, `podeAlterarActividade`, `alterarComPermissao`, `flagsActividade`) + `toActividadeGet(a, flags)`; flags `pode_editar`/`pode_apagar` em `GET /actividades` e `GET /actividades/:id`.
- Front: `ActividadesList` usa as flags no lápis/apagar; `ActividadeUpsertModal` desactiva Tipo/Laboratório no modo edição e só o Admin edita o Responsável. (O detalhe de Atividade não tinha botões de editar/apagar.)

#### Como estava antes / o problema
- Não havia verificação de autoria/estado nos `PUT/DELETE` de atividade e sessões: qualquer utilizador com o cargo base (A,P,C,S,CD) podia editar/apagar a atividade de outro, mesmo já revista, e alterar `tipo`/`laboratorio_id`/`responsavel_id` sem restrição. Editar também repunha silenciosamente as decisões (sessões recriadas) sem aviso nem verificação.

---

### 2.15. Materiais no formulário de atividades — acesso do professor (✅ E10)

> **Estado:** ✅ implementado (E10) — **sem migração** e **sem alterar o RBAC** de `/materiais` (o professor continua sem acesso às rotas gerais).

#### O problema
O passo «Materiais» do `ActividadeUpsertModal` usava `GET /materiais` (RBAC A,T,C,S,CD) para listar os materiais do laboratório. Para o **professor** devolvia **403**, a lista ficava vazia e mostrava a mensagem enganadora «Selecione um laboratório no passo 1…» — impedindo-o de pedir materiais por sessão (RF08b), embora o professor **não deva** ter acesso às rotas gerais de materiais.

#### Correção (endpoint de leitura mínima dedicado)
- Novo `GET /materiais/opcoes?laboratorio_id=` (roles = `MAT_ROLES` + `professor`; declarado **antes** de `/:id`). Devolve **só** `{ id, nome, unidade, quantidade, laboratorio_id }` de materiais `activo` (a `quantidade` é o stock actual via `stockActual`). `MAT_ROLES` e todas as outras rotas ficam **inalteradas** — o professor mantém **403** em `GET /materiais`, `GET /materiais/:id`, histórico, escrita e movimentos.
- Front: `materiaisService.listOpcoes(laboratorioId)` (+ tipo `MaterialOpcao`); o passo «Materiais» usa-o para **todos** os perfis, com `.catch` que mostra o **erro real** em vez da mensagem enganadora. O dashboard e a página `/materiais` não mudam.
- - Verificado: smoke HTTP (professor 200 em `/materiais/opcoes` e 403 nas restantes; outros perfis inalterados; criar/editar com materiais por sessão de ponta a ponta) + browser real (professor vê a lista no passo «Materiais»).

---

### 2.16. Datas das sessões e formulário de actividades (futuro + período) — ✅ implementado

> **Estado:** ✅ concluído (backend + front, **sem migração de schema**, deploy pendente).

#### O problema
- As datas da sessão só eram validadas **no front**, e só contra o passado (dia de calendário). O backend aceitava sessões no passado.
- Nada garantia que uma sessão de **projeto/estágio** caísse dentro do período `[data_inicio, data_fim]` da especialização.
- O formulário de **estágio** pedia `título`/`descrição`, que **não existem na tabela `estagios`** (só o `projecto` tem essas colunas) — pedido inútil que podia bloquear o submit.
- As datas macro do projeto/estágio (passo 2) não desactivavam dias passados no calendário.

#### Correcção
- **Backend (`utils/validarSessao.js`):** `validarSessao(sessao, periodo)` valida agora, além dos limites de participantes (RF20): a **data no futuro** (só o dia de calendário em hora local; **hoje é permitido**; sem limite de hora — mesma definição do `hojeISO()` do front) e **dentro de `[inicio, fim]`** quando `periodo` é indicado. Novo `periodoDaActividade(act)` lê o período da BD (projecto/estágio; `null` em aula/visita). Mensagens 400: `«A data da sessão (dd/mm/aaaa) não pode estar no passado.»` e `«A data da sessão (dd/mm/aaaa) está fora do período do projeto|estágio (dd/mm/aaaa a dd/mm/aaaa).»`. Chamado em `POST /actividades/full`/`PUT /:id/full` (período vindo dos `detalhes`) e em `POST /agendamentos`/`PUT /agendamentos/:id` (período lido da BD via `periodoDaActividade`). **Não** bloqueia sessões já aprovadas/realizadas.
- Front (`ActividadeUpsertModal`): datas de projeto/estágio com `min` (`data_fim >= data_inicio`); passo 3 com `min`/`max` = período; alterar o período mostra erro e **não apaga** as sessões; responsável em edição só o Admin altera (Select desactivado com nota para os restantes); passo «Materiais» não repete o mesmo material **na mesma sessão**; estágio deixa de pedir `titulo`/`descricao` (só projeto).

### 2.17. Regras gerais de agendamento — regra de fim de semana (configurável) — ✅ implementado

> **Estado:** ✅ concluído (backend + front + **1 migração aditiva**, deploy pendente).
> **Escopo fechado:** só criar a tabela `configuracoes_gerais` (linha única) e a regra de fim de semana. **Não** se criou um motor genérico de regras nem regras de feriados/antecedência.

#### O problema
- O sistema não tinha **nenhum** interruptor de política para impedir agendamentos ao sábado/domingo; qualquer perfil autenticado podia submeter sessões ao fim de semana e o Supervisor aprovava-as.

#### Como ficou
- **BD (migração `20261020000000_configuracao_geral`, aditiva):** tabela `configuracoes_gerais` (linha única, `id = 1`) com `permitir_fim_semana BOOLEAN NOT NULL DEFAULT false` + BaseEntity (`criado_em`, `actualizado_em`, `activo`). Linha garantida de forma **idempotente** por `ensureConfiguracaoGeral()` (`server/src/db.js`, chamada no `initDb` e em `server/scripts/seed-configuracao.js`) — mesma abordagem de `ensureLimitesParticipantes()`.
- **Backend:** `GET /configuracao/geral` (**qualquer autenticado** — o formulário do Professor precisa de ler a regra) e `PUT /configuracao/geral` (só **Admin**; valida booleano, faz upsert de `id = 1`). Util partilhada `utils/configuracao.js` (`obterConfiguracaoGeral`, `CONFIGURACAO_GERAL_DEFAULT`) lê **uma vez por pedido** e passa a configuração às validações.
- **Validação (`utils/validarSessao.js`, regra 5):** `validarSessao(sessao, { periodo, configuracao })` — a assinatura passou a aceitar **contexto**, para que regras futuras (feriados, antecedência mínima) entrem sem reescrever os 4 pontos de chamada. Com `permitir_fim_semana === false`, uma sessão cuja **data de calendário** caia a sábado ou domingo devolve **400**: `«Não é permitido agendar ao fim de semana (dd/mm/aaaa é sábado).»`.
- **Dia da semana sem conversão de fuso:** back `Date.UTC(a, m-1, d).getUTCDay()`; front `new Date(a, m-1, d).getDay()` — mesma filosofia do `hojeISO()`; o ISO `aaaa-mm-dd` nunca passa por um `Date` de meia-noite local.
- **Aplica-se a (só escrita):** `POST /actividades/full`, `PUT /actividades/:id/full`, `POST /agendamentos`, `PUT /agendamentos/:id`.
- **Nunca afecta:** decisões/aprovações (individual ou em lote), «Deixar pendente», rejeição de atividade, confirmações de presença (RF14), atribuição de técnicos, relatórios, calendário, **leituras** e, sobretudo, **sessões já existentes** — nada é bloqueado em massa nem reescrito. **Sem excepção para Admin** (a regra é política do sistema, não de perfil).
- **Front:** novo separador **«Regras de agendamento»** em `/configuracao` (Switch `#permitir-fim-semana` + «Guardar regras», com `ErrorState`/`Spinner` no carregamento e toast de sucesso/erro). No `ActividadeUpsertModal`, passo 3 mostra a nota «Fins de semana não permitidos.» quando a opção está **desligada** e o erro devolvido pelo `getStepError(3)` **impede avançar** (mensagem específica, não apaga a sessão). Se a leitura de `/configuracao/geral` falhar, o formulário **continua a funcionar** (só mostra um aviso) — não depende da leitura para criar.

#### Verificação
- **Smoke HTTP (31/31):** GET default `false` (Admin + Professor); PUT professor → **403**; PUT valor inválido → **400**; 7 dias consecutivos via `POST /agendamentos` (Seg–Sex 2xx, Sáb/Dom **400** com a mensagem certa); `PUT /agendamentos/:id` a mover para sábado → 400 e para dia útil → 2xx; `POST`/`PUT /actividades/full` com sessão de fim de semana → 400; opção ligada → sábado/domingo aceites (2xx) e as criações são aceites. **Inalterado com a opção desligada:** aprovar (DLab e Supervisor), rejeitar, deixar pendente, confirmar presença (professor + técnico) numa sessão de fim de semana criada enquanto a opção estava ligada. **Sem 500/excepções** no log do servidor (0 bytes novos após o smoke).
- **Browser (15/15):** switch arranca `false` e **persiste após reload**; Professor `/configuracao` → redirecciona para `/inicio` (sem acesso); com a opção **desligada** o formulário mostra a nota e **bloqueia o avanço** com a mensagem `Não é permitido agendar ao fim de semana…`; com a opção **ligada** a nota desaparece e a criação ao fim de semana **conclui**. Dados `TESTE-*` limpos; `permitir_fim_semana` reposto a `false`.
- **Nota sobre dados existentes:** a base já continha **13 sessões ao fim de semana** (ex.: `ag#12` 2026-10-10 sáb, `ag#13` 2026-10-17 sáb, `ag#102`/`ag#104` 2026-11-01 dom) — todas **intactas**, porque a regra só corre na criação/edição.

---

### 2.18. Campos de data do formulário de Actividades — picker com dias desactivados — ✅ implementado

> **Estado:** ✅ concluído (front, **sem migração**, deploy pendente).
> **Escopo fechado:** substituir os 3 `<input type="date">` do `ActividadeUpsertModal` (data_inicio, data_fim, dia da sessão) por um picker que **impede a selecção de dias inválidos**. **Não** se alterou o backend, a validação existente nem o input de navegação do `Calendario.tsx` (fora de escopo).

#### O problema
- Os 3 campos de data do formulário eram `<input type="date">` nativos: o utilizador via o calendário do browser mas podia escolher dias inválidos (passado, fim de semana com a regra do RF21 desligada, dias fora do período de projeto/estágio); o erro só aparecia no submit.

#### Como ficou
- **Util partilhada `src/utils/dateInput.ts` (fonte única das regras de dia):** conversões **locais** `deISO`/`paraISO`/`hojeISO`/`fmtBR`/`toDateInput`, `diaSemana`/`ehFimDeSemana` (sem conversão de fuso — mesma filosofia do RF21) e a regra central **`diaDesactivado(date, regras: RegrasDia)`** com regras numeradas: (1) passado; (2) `min`/`max` inclusive; (3) fim de semana quando `permitirFimSemana === false`. Tem um **PONTO DE EXTENSÃO** explícito (comentário) para regras futuras — os **feriados** já foram acrescentados (✅ RF22, §2.20); falta a antecedência mínima.
- **Componente partilhado `src/components/ui/date-field.tsx`:** Popover (Radix) + `Calendar` (`ui/calendar.tsx`, react-day-picker v8) com `locale={ptBR}`, `weekStartsOn={1}`. O `value`/`onChange` são **sempre `aaaa-mm-dd`** (strings), a mostrar `dd/mm/aaaa`. Dias desactivados via prop `isDayDisabled?: (date) => boolean`; `min`/`max` aplicados; dia desactivado é **cinzento e não clicável** (react-day-picker v8, `disabled`). Acessibilidade: nomes acessíveis por dia via `formatters.formatDay` (span `sr-only`, ex.: «quarta-feira, 21 de outubro de 2026»), navegável por teclado, popover utilizável a 390px de largura (`w-auto max-w-[calc(100vw-1rem)]`).
- **Regras por campo (só o que faz sentido):**
  - **Dia da sessão:** passado + fora do período `[data_inicio, data_fim]` (projeto/estágio) + fim de semana quando a regra do RF21 está desligada.
  - **data_inicio:** só passado (fim de semana **não** desactivado — a macro pode começar/terminar ao fim de semana).
  - **data_fim:** passado + dias antes de `data_inicio`.
- **Edição:** um valor já existente que passe a desactivado (ex.: sábado com a regra agora ligada) é **mostrado** no campo com `aria-invalid` e nunca é **apagado em silêncio**; o utilizador tem de escolher outro dia.
- **Rede de segurança intacta:** todas as validações/mensagens do `getStepError` (futuro, período, fim de semana, limites de participantes) **mantêm-se** — o picker só evita o erro antes do submit.

#### Verificação
- **Fuso horário (unit, script temporário fora do repo):** bundle esbuild do util + 44 asserções em `TZ=UTC` e `TZ=Africa/Luanda` — **44/44 em ambos** (meia-noite/mês/ano/anos bissextos, round-trips, `diaDesactivado` com fim de semana OFF/ON/nulo, `min`/`max` inclusive).
- **Browser (Playwright/Edge, 33/33):** regra OFF → sábado/domingo desactivados, dia útil e hoje activos, ontem desactivado, clicar desactivado é **no-op**, escolha preenche `dd/mm/aaaa` e o payload `POST` contém exactamente o dia clicado (`hora_inicio:"2026-10-22T09:00"`); regra ON → sábado clicável; **estágio** → data_inicio/data_fim aceitam fim de semana, data_fim bloqueia antes do início, sessão bloqueia pré-período e sábado dentro do período (regra OFF); **edição** → o sábado desactivado **mostra-se** e o campo fica `aria-invalid`; **390px** → popover dentro do viewport e clicável; limpeza OK.
- **Edição + regressão de aprovação:** mudar o dia de uma sessão e guardar via UI → `PUT /actividades/:id/full` com o dia novo, BD actualizada; DLab aprova e Supervisor rejeita continuam a funcionar (201). `typecheck` 0 erros, `lint` 0 erros (17 warnings baseline).

---

### 2.19. Validação de Estágio/Visita e correção de 500 — ✅ implementado

> **Estado:** ✅ concluído (front + backend, **sem migração**, deploy pendente).
> **Escopo:** tornar obrigatório o estudante no estágio, validar formato de visita (telefone 9-15 dígitos, email) e garantir respostas 400 claras (sem 500).

#### Causa real do 500 (estágio sem estudante)
No código anterior (HEAD), `montarDetalhes('estagio', det)` devolvia `null` quando `estudante_id` era nulo/ausente. Em `POST /actividades/full`, o código verificava `if (!spe) return res.status(400)...` — **isso devia devolver 400**. No entanto, consoante o caminho/teste manual (e em `PUT /actividades/:id/full` anterior a esta correção), a ausência podia levar a fluxos onde a validação não era explícita o suficiente ou o erro era propagado para `next(err)` gerando 500. Além disso, `POST /estagios` exigia `estudante_id` mas, caso a validação falhasse noutro ponto, o comportamento podia ser confuso. Com as correcções actuais, **todas** as variantes são validadas explicitamente: `estudante_id` em falta/null/""/0/"abc", inexistente ou inactivo devolvem **400** com mensagem clara (`«Seleccione o estudante»` / `«Estudante inválido»` / `«Estudante não encontrado ou inactivo»`).

#### Como ficou
- **Front (`ActividadeUpsertModal`)**: no passo 2, estágio exige `estudanteId` → `«Seleccione o estudante»`. Visita: telefone sanitizado a só dígitos (`maxLength=15`, `inputMode="numeric"`), email com `placeholder="exemplo@gmail.com"`. Validação no `getStepError(2)` com mensagens específicas; botão «Próximo»/submissão bloqueados até válido.
- **Backend (`POST/PUT /actividades/full`)**: `montarDetalhes` para visita valida telefone sanitizado `^[0-9]{9,15}$` e email `^[^\s@]+@[^\s@]+\.[^\s@]+$`; para estágio valida `estudante_id` inteiro >=1 e verifica existência/activo na BD antes de gravar. Erros devolvem **400** (`«Telefone inválido (9 a 15 dígitos)»`, `«Email inválido»`, `«Seleccione o estudante»`, `«Estudante inválido»`, `«Estudante não encontrado ou inactivo»`).
- **Backend (`POST /estagios`, `POST /visitas`)**: validação explícita com **400** em todos os casos de formato/inexistência/inactivo.

#### Verificação (com IDs reais)
- **Criar** (201): aula, visita, projecto, estágio com estudante válido.
- **PUT /actividades/:id/full** (IDs reais): vazio/details incompletos → **400**; estágio `estudante_id` null/""/0/"abc"/999999/inactivo → **400**; visita tel com letras/curto e email inválido/sem ponto → **400**; visita e estágio válidos → **200** (dados gravados).
- **POST /estagios** sem estudante → **400**; **POST /visitas** tel com letras/curto/email inválido/sem ponto → **400**.
- **Browser**: estágio não avança sem estudante; visita aceita só dígitos e mostra erros por formato; criar/editar um de cada tipo funciona sem 403 novos.

---

### 2.20. Feriados — registo configurável e bloqueio de novos pedidos — ✅ implementado

> **Estado:** ✅ concluído (backend + front + 1 migração aditiva, deploy pendente).
> **Escopo:** registar feriados (data exacta ou anual) e impedir **novos pedidos** de sessões nesses dias, com relatório de sessões afectadas. Complementa a RF21 (fim de semana) e reutiliza o mesmo ponto central (`utils/validarSessao.js`) e o mesmo padrão de configuração (`configuracoes_gerais`, linha `id = 1`).

#### O problema
- O sistema já impedia agendamentos ao fim de semana (RF21), mas não tinha forma de registar feriados nem de bloquear sessões nesses dias. Um pedido submetido para um feriado era aceite.

#### Como ficou
- **BD:** enum `FeriadoTipo { feriado, feriado_movel, ponte, tolerancia }` e tabela `feriados` (BaseEntity: `id`, `criado_em`, `actualizado_em`, `activo`, + `nome`, `data DATE @unique`, `tipo`). `configuracoes_gerais` ganhou `permitir_feriados BOOLEAN DEFAULT false` (mesma linha `id = 1` do RF21). Migração `20261021180000_feriados` aditiva (CREATE TYPE/TABLE + ADD COLUMN).
- **Regras:** só `tipo='feriado'` é **anual** (mesmo dia/mês do ano de registo em diante); 29/02 anual → 400; data efectiva em conflito com outro feriado activo → 409 com o nome; `POST` de uma data exacta já existente mas removida (soft delete) **reactiva** o registo (200); `DELETE` = soft delete (204).
- **Validação:** `utils/validarSessao.js` ganhou `feriadoCobre`, `motivoDiaBloqueado` e `obterFeriadosParaValidacao`; `validarSessao(sessao, { periodo, configuracao, feriados })` acrescenta a regra do feriado. Com a regra desligada devolve 400 `«Não é permitido agendar nesta data: dd/mm/aaaa é <tipo> (<Nome>).»` (`<tipo>` = rótulo do `FeriadoTipo`: `feriado`, `feriado móvel`, `ponte`, `tolerância de ponto`); quando o dia é sábado/domingo e ambas as regras bloqueiam, a **mensagem de fim de semana tem precedência**. Aplica-se aos **4 pontos de escrita** (`POST`/`PUT /actividades/full`, `POST`/`PUT /agendamentos`), com config e feriados lidos **uma vez por pedido**. **Nunca** afecta decisões/aprovações, «Deixar pendente», confirmações de presença (RF14), técnicos, relatórios, calendário/leituras nem sessões já existentes; sem excepção para Admin.
- **Impacto:** `POST`/`PUT /configuracao/feriados` devolvem `sessoes_afectadas_count` + `actividades_afectadas: [{id,nome,sessoes:[{agendamento_id,data}]}]` (sessões activas, não rejeitadas, a partir de hoje; anual cobre qualquer ano futuro com o mesmo dia/mês). O registo prossegue sempre; o front mostra um diálogo «Sessões afectadas» e não cancela nada.
- **RBAC:** leitura (`GET /configuracao/feriados`, `GET /configuracao/geral`) para qualquer autenticado; escrita só Admin.
- **Front:** `FeriadoUpsertModal` (create/edit; data via `DateField`; Select do tipo; diálogo de sessões afectadas), separador **«Feriados»** em `/configuracao` (`FiltersBar` nome/tipo + `SimplePagination` + `ConfirmDialog` para remover), Switch **`#permitir-feriados`** em «Regras de agendamento» (guarda em conjunto com o fim de semana), e no `ActividadeUpsertModal` passo 3 a nota **«Feriados não permitidos.»** + dias de feriado desactivados no `DateField` (via `feriadoCobre`/`ehFeriado` e extensão do `RegrasDia`). A falha ao ler feriados só avisa (não bloqueia o formulário).

#### Verificação
- **Smoke HTTP 31/31:** RBAC (professor 403 em escrita, 200 em leitura), validações 400 (nome/tipo/data/29-02), 409 duplicado e cobertura anual, anual 200, `PUT` nome/data, `DELETE` 204, `GET` exclui removidos, reactivação (mesmo id), `PUT /geral` vazio 400, bloqueio em feriado com a regra OFF e aceitação com ON, precedência do fim de semana, `/full` bloqueado/aceite, criar editar remover.
- **Impacto 6/6:** `sessoes_afectadas_count` e `actividades_afectadas` para uma sessão futura existente, na data exacta e por cobertura anual.
- **Browser (Edge/Playwright) 15/15:** criar/editar/remover pela UI, tipo apresentado como «Feriado (anual)», Switch persiste após reload, `PUT /geral` reflecte o estado, nota visível e dia de feriado desactivado no formulário da actividade, sem erros de runtime.
- `typecheck` 0 erros; `lint` 0 erros (1 warning pré-existente em `Configuracao.tsx`). `migrate diff --exit-code` sem diferença. Dados `TESTE-*` limpos; regras repostas a `false`.

#### Correções da Parte 2 (regressão de validações, turma, regras obsoletas)
> **Estado:** ✅ concluído (backend + front + script de teste; **sem migração**, deploy pendente). Não altera as regras do RF22 — corrige o que ficou a faltar na 1.ª entrega e afina o formulário.

1. **RF13 + stock restaurados no `PUT /actividades/:id/full` (regressão).** O commit **`9d53106`** («Validação de estudante no estágio e de telefone/email na visita | estável») reescreveu o handler e removeu **quatro** validações que o `POST /full` continuava a fazer: `validarAgendamentos` (RF13/choque), `validarMateriais` (stock/RF17), `obterConfiguracaoGeral` (RF21/RF22) e `validarParticipantesSessoes` (RF20). O RF22 restaurou as duas últimas; a Parte 2 restaurou as duas primeiras: `validarAgendamentos(novoLabId, ags, act.id)` (exclui a própria atividade, porque as sessões são desactivadas e recriadas — RF08d) e `validarMateriais(novoLabId, mats)`. **Porque passou despercebido:** nenhum teste afirmava RF13/stock no `PUT` (o smoke do RF22 só verificava a rejeição por feriado e o da RF20 só o intervalo de participantes).
2. **Matriz reutilizável de validação** — `server/scripts/matriz-validacoes-sessoes.mjs`: Express **em processo** (porta efémera), **7 regras × 4 pontos de escrita** (mínimo/máximo activo, capacidade, período de projeto/estágio, passado, fim de semana, feriado) + RF13 e stock nos dois `/full` = **32 verificações**; cria só dados próprios (`TESTE-MATRIZ-<run>`) e apaga **apenas os ids que criou** (`--keep` para inspeccionar). Antes da correcção **30/32** (falhavam RF13 e stock no `PUT /:id/full`); depois **32/32**.
3. **Nº da turma estrito:** `numero_turma` é opcional (`Int?`), mas quando indicado tem de ser **inteiro ≥ 1**. Helper partilhado `server/src/utils/numeros.js` (`inteiroOpcional`) usado em `montarDetalhes` (`POST`/`PUT /full`) e `POST /aulas`; rejeita `0`, negativos, decimais, texto, booleanos, arrays e fora de `Int32` com 400 `«O número da turma tem de ser um inteiro maior ou igual a 1.»`; vazio/`null`/ausente grava `null`. DTO `toAulaGet` só constrói `turma` quando > 0. Front: `NumberInput min={1} allowDecimal={false}` (digitar `0` corrige para `1`) e payload `null` quando vazio. Auditoria à BD: 16 aulas, 0 com `0`/negativo, 1 `null` legado (aula 84 / atividade 91).
4. **Regras sempre frescas no formulário:** as leituras de `/configuracao/*` saíram do efeito de montagem e passaram para o efeito `[open, actividade]` — abrir o modal relê limites, regra geral e feriados (0 pedidos antes de abrir, 3 ao abrir; alteração de `permitir_feriados` reflectida sem reload).
5. **Fim de semana vs. feriado (front):** a nota e o erro de feriado dependem só de `permitir_feriados` (+ existirem feriados); a precedência da mensagem de fim de semana só se aplica **quando o fim de semana está bloqueado** — com fins de semana permitidos, um sábado que seja feriado é rejeitado com a mensagem do feriado (antes o front ignorava-o e só o backend travava).
6. **Filtro por ano nos feriados:** um `feriado` anual aparece nos anos seguintes com a **data efectiva** (ex. `08/12/2026` + `(em 2027: 08/12/2027)`); os outros tipos só no ano exacto.
7. **Nomes PT-PT:** os campos do relatório de impacto passaram de `afetadas` para **`sessoes_afectadas_count`** / **`actividades_afectadas`** (API, tipos, service, modal e docs); 0 referências antigas. Ficam **sem alteração** (pré-existentes, fora do âmbito): `atividade`/`atividades`, `atualiz*`, `ativo`/`ativa` — normalização ortográfica global a decidir.
8. **Auditoria de coerções numéricas (só inventário):** continuam permissivos `curso_disciplinas.semestre`, `materiais.quantidade_minima`/`quantidade_inicial` (aceita negativo), `historico_materiais.quantidade_movimentada`, `relatorios.mes`/`ano` e `Number(req.params.id)` (`NaN` → 404/500 em vez de 400).

**Verificação final (regressões do fluxo):** smoke por tipo **38/38** (CRUD de aula/visita/projeto/estágio, DLab→Supervisor com técnicos, «Deixar pendente», rejeição individual, `POST /aprovacoes/:id/rejeitar`, confirmações professor+técnico com baixa de stock idempotente, **RF08c** 409 após decisões e `DELETE` soft), com dados próprios (`TESTE-FLUXO-*`) apagados por id; stock **8/8** materiais consistentes (`quantidade` = SUM do histórico); config reposta a `permitir_fim_semana=false` / `permitir_feriados=false`.

---

### 2.21. Build da Vercel + campos obrigatórios por tipo + smoke de fluxo — ✅ implementado

> **Estado:** ✅ concluído (backend + front + 2 scripts; **sem migração**, deploy pendente).
> **Escopo:** destravar o build da Vercel (falhava com `TS2322`), tornar **obrigatórios** os campos que a realidade exige por tipo de atividade, e guardar no repositório um smoke de fluxo completo dos 4 tipos. A tabela de decisão front/backend e a causa do turno estão em §2.21.2.

#### 2.21.1. Build da Vercel (Parte 0)

- **O que a Vercel corre:** `vercel.json` → `buildCommand: npm run vercel-build`; o script é `prisma generate --schema server/prisma/schema.prisma && npm run build` e `build` é `tsc -b && vite build`. Este é o **critério oficial de typecheck** (ver `AGENTS.md` §6 «Como verificar»).
- **Erro reproduzido:** `ActividadeUpsertModal.tsx(481,9) TS2322 … Type 'undefined' is not assignable to type 'string'` (exit 2). Causa: o payload de detalhes podia enviar `numero_turma: undefined` (o tipo dizia `string`/opcional) e o `getStepError` devolvia `string | null | undefined`.
- **Correcção:** `ActividadeDetalhesPayload` passou a espelhar a realidade (aula: `numero_turma: number`; visita: `instituicao: string`), o payload envia `Number(numeroTurma)` e o erro de passo foi estreitado **sem asserções** (sem `any`/`as any`/`@ts-ignore`/`@ts-expect-error`; `strict` intacto).
- **Falso «0 erros» anterior:** `tsc --noEmit -p tsconfig.app.json` **detectava** o erro (exit 2), mas o comando usado antes (`cmd /c "... & echo EXIT=%errorlevel%"`) expandia `%errorlevel%` **antes** de correr o `tsc`, imprimindo sempre 0. O build só é válido quando o próprio `npm run vercel-build` termina com **exit 0**.
- **Resultado:** `cmd /c "npm run vercel-build"` → exit **0** (inclui `vite build`).

#### 2.21.2. Tabela de obrigatoriedade (auditoria front vs. backend)

| Tipo | Campo | Antes (front) | Antes (backend) | Decisão |
|---|---|---|---|---|
| aula | `curso_disciplina_id` | obrigatório | obrigatório | mantém |
| aula | `tema` | opcional | opcional | **obrigatório** |
| aula | `turno` | pré-seleccionado `manha` | opcional/ignorado | **obrigatório**, sem pré-selecção |
| aula | `numero_turma` | opcional | opcional (0/negativo → `null` silencioso) | **obrigatório**, inteiro `>= 1` |
| visita | `instituicao` | opcional | opcional | **obrigatório** |
| visita | `nome_visitante`/`telefone`/`email` | opcionais | opcionais (telefone/email validados se preenchidos) | mantém |
| projeto | `titulo`, `data_inicio`, `data_fim` | obrigatórios | obrigatórios | mantém |
| estágio | `estudante_id`, `data_inicio`, `data_fim` | obrigatórios | obrigatórios | mantém |

- **Porque o turno passava sem escolha:** o formulário inicializava o estado com `'manha'` (`useState('manha')`), pelo que o Select **nunca ficava vazio** e o pedido seguia sempre com um turno válido; o backend, por sua vez, aceitava a ausência do campo. O utilizador não conseguia distinguir «não escolhi» de «escolhi manhã». Passou a `useState('')` com placeholder «Seleccione o turno» + erro de passo.
- **Outras discrepâncias encontradas na auditoria:** apenas reportadas, não alteradas (ex.: `nome_visitante` continua opcional; coerções numéricas permissivas listadas em §2.20 item 8).

#### 2.21.3. Implementação

- **Backend:** `montarDetalhes` (`actividades.routes.js`) valida `tema`, `turno` (só `manha`/`tarde`), `numero_turma` (presença + `inteiroOpcional`) e `instituicao`; nulo, vazio e **só espaços** contam como ausente. Devolve tokens internos que `mensagemDetalhes(spe, tipo)` traduz em **400** — aplicado a `POST /actividades/full`, `PUT /actividades/:id/full`, `POST /aulas` e `POST /visitas`.
- **Front:** `getStepError(2)` devolve «Indique o tema», «Seleccione o turno», «Indique o número da turma (mínimo 1)» e «Indique a instituição»; labels com ` *`; turno sem pré-selecção. Lista de feriados anuais com espaço antes do parêntese (`02/11/2026 (em 2027: 02/11/2027)`), sem alterar o formato.
- **Scripts:** `matriz-validacoes-sessoes.mjs` ganhou a secção «C. obrigatoriedade por tipo» (aula sem tema/turno/turma, turma `0`/`-1`/`1.5`/texto, visita sem/vazia/só espaços) → **50/50**; novo `smoke-fluxo-atividades.mjs` → **38/38** (detalhes em `AGENTS.md` §6).
- **Dados existentes (só leitura, nada alterado):** 16 aulas activas e 4 visitas activas; **1 aula sem tema** (aula 5 / atividade 8 «teste novamente»), **0 sem turno**, **1 sem `numero_turma`** (aula 84 / atividade 91 «mudando nome») e **1 visita sem instituição** (visita 15 / atividade 82 «X»). Não foram corrigidos — ficam como legado (os DTOs toleram `null`).
- **Sobreposição no Supervisor (verificação 1.7, só leitura + teste):** o Supervisor **não** revalida choque ao aprovar (as decisões apenas mudam estado). Duas atividades pendentes no mesmo laboratório/horário foram **ambas aprovadas** (DLab + Supervisor), enquanto um `POST /agendamentos` novo sobre uma sessão já aprovada continua a devolver **409** (RF13). Decisão de produto pendente: avaliar se a aprovação do Supervisor deve revalidar RF13 (hoje não revalida).
- **Verificação:** matriz **50/50**, smoke **38/38**, `lint` 0 erros (17 warnings pré-existentes), `npm run vercel-build` exit **0**; browser (professor) confirmou as 4 mensagens, criou e editou os 4 tipos sem 403/5xx novos (dados `TESTE-BROWSER-*` apagados por id). Config reposta a `permitir_fim_semana=false` / `permitir_feriados=false`.

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
4. **[Médio]** Sem `helmet` (headers de segurança) e sem `express-rate-limit` no `/user/login` (brute force). — ✅ **[E4]**: `helmet` + `express-rate-limit` por camada (leituras 5000/15min, escritas 1000/15min, login 20/15min).
5. **[Médio]** CORS aberto (`cors()` sem whitelist) — em produção, qualquer origem fala com a API se o token vazar. — ✅ **[E4]**: whitelist `localhost` + `*.vercel.app` + `CORS_ORIGINS` (env); pedidos sem Origin aceites.
6. **[Médio]** JWT sem refresh tokens/revogação; logout apenas client-side.
7. **[Médio]** `JWT_SECRET` com fallback hardcoded (`dlab-dev-secret-change-in-production`) — forçar via env em produção, sem default.
8. **[Baixo/Médio]** Upload de documento não existe (multer 🔴) — `anexo_path` aceita qualquer string/URL; sem sanitização de path.
9. **[Baixo]** erros lançam `err.message` ao cliente (500) — fuga de detalhes internos.
10. **[Baixo]** Email: criação exige `@isptec.co.ao` mas seeds usam `@isptec.pt` (inconsistência a alinhar). — ✅ seed actualizado para `@isptec.co.ao`.

### 5.2. Funcionalidade (bugs/desvios)
1. **[Alto]** `finalizar` Supervisor bloqueia com agendamentos `pendente` — comportamento contrário ao desejado (§2.11).
2. **[Alto]** Perfil não-admin sem dados (bug de consumo, §2.12).
3. **[Médio]** ~~Histórico de aprovações com comentário repetido por agendamento e sem agendamentos afectados~~ (§2.10). — ✅ resolvido com `DecisaoAgendamento` (§0.1): uma linha por agendamento, com o agendamento e o decisor associados.
4. **[Médio]** `GET /disciplinas/:id` e `PUT /curso-disciplinas/:id` ausentes (spec original tinha).
5. **[Médio]** Relatórios: PDF mínimo com raw JSON (`buildMinimalPdf`, 3000 chars) — sem pdfkit.
6. **[Médio]** Sem relatório automático mensal nem alertas de stock real (cron/socket), `NotificacoesContext` usa mocks.
7. **[Baixo]** `mockData.ts` morto; `server/seed.js`, `server/data/*`, `config.js/DATA_FILE` legado não consumidos (§4). — ✅ **[E4]** removidos (ficheiros + `DATA_FILE` do `config.js`).
8. **[Baixo]** ~~`scripts/migrate-json.js` desactualizado~~ — ✅ **[E4]** ficheiro removido (não era consumido em runtime).
9. **[Baixo]** Calendário começa fixo em Jun/2026 e sem "Hoje"/visões (§2.7).
10. **[Baixo]** Listagens sem filtros/paginação (Labs, Cursos, Disciplinas, Aprovações, Relatórios) (§2.2).
11. **[Baixo]** `AprovacaoDetalhe`/`ActividadeDetalhe` saturadas; falta tabs (§2.8/2.9).
12. **[Baixo]** Sem detalhe de estudante e sem detalhe de curso (§2.4/2.5).
13. **[Baixo] ✅ implementado (B1)** `GET /user` é admin-only mas o `ActividadeUpsertModal` chamava-o no *mount* do componente (o modal está montado mesmo fechado em `ActividadesList`), logo o **professor** recebia **403** sempre que abria a página `/actividades` (silencioso: tinha `.catch(() => setUsers([]))`). **Correcção (opção a):** o modal passou a fazer o pedido **só quando o utilizador é Admin** (`useEffect([user?.tipo])`); nos restantes perfis não há pedido e o responsável é o próprio utilizador. **Decisão do dono do projecto:** só o Admin atribui o responsável (não se cria endpoint novo por agora); não se alterou quem pode criar atividades (RBAC `ACT_ROLES`) nem a RF08c. Verificado em browser (Admin `GET /user` 200; professor sem pedido e sem 403).
14. **[Médio/A CONFIRMAR]** **Sem protecção contra auto-aprovação:** quem é **responsável** (ou criou) uma atividade pode aprová-la ele próprio na fila — a autorização só verifica o **cargo** (`podeVotarEtapa`: DLab = `coordenador_dlab`+`admin`; Supervisor = `supervisor`+`admin`), **nunca** compara o decisor com `actividades.responsavel_id`/`criado_por_id`. Concretamente, um Coordenador DLab que crie/tenha uma atividade como responsável pode votá-la na etapa DLab; um Supervisor idem na etapa Supervisor; o Admin é permitido em ambas. Se se quiser separação de funções, é preciso bloquear o decisor = responsável/autor (a decidir com o dono do projecto; **sem alteração de código por agora**).
15. **[Baixo/A CONFIRMAR]** **Responsável de projeto/estágio pode não ser professor:** `resolverResponsavel` só obriga «professor» para o tipo `aula`; em `projecto`/`estagio` aceita o próprio autor. Como só o Admin escolhe o responsável (B1), um Coordenador/Supervisor/Chefe que crie um projeto/estágio **fica como seu responsável** (não-professor) — aceite nesta fase. (Se RF06 exigir mesmo professor em projeto/estágio, endurecer o backend — a decidir.)
16. **[Médio] ✅ implementado (RF21)** **Sem interruptor de política de agendamento:** o sistema não permitia impedir agendamentos ao fim de semana (sábado/domingo). **Implementado:** tabela única `configuracoes_gerais` (`id = 1`) com `permitir_fim_semana` (default `false`), `GET /configuracao/geral` (qualquer autenticado — o Professor precisa de ler a regra) + `PUT /configuracao/geral` (Admin), regra 5 em `utils/validarSessao.js` aplicada nos **4 pontos de escrita** (`POST`/`PUT /actividades/full`, `POST`/`PUT /agendamentos`) com 400 `«Não é permitido agendar ao fim de semana (dd/mm/aaaa é sábado).»`. **Não** afecta decisões/aprovações, confirmações de presença, técnicos, leituras/calendário nem sessões já existentes. Front: separador «Regras de agendamento» em `/configuracao` (Switch + guardar) e nota + bloqueio de avanço no `ActividadeUpsertModal` passo 3. Detalhes e verificação em §2.17.

### 5.3. Padronização (código/UI/UX)
1. **[Médio]** Selects sem pesquisa em vários modais; catalogs hardcoded (enums) — deve usar `SearchSelect` com CRUD + "criar na hora" (§2.1).
2. **[Médio]** Padrão de listagem inconsistente (nem todas usam `FiltersBar`+`SimplePagination`) (§2.2).
3. **[Médio]** `window.prompt` viola a norma "nunca usar confirm/alert/prompt nativos" (§2.3).
4. **[Médio]** Validação só no submit; `type=number` aceita `-1`/`e` (§2.13).
5. **[Baixo]** `@tanstack/react-query`, `zustand`, `react-hook-form`(parcial), `@tanstack/react-table`, `react-day-picker` instalados mas sem uso — peso morto no bundle. — ✅ **[E4]** removidos `react-query`/`zustand`/`react-table`/`@supabase/supabase-js`/`zod`/`@hookform/resolvers`; `react-hook-form` (usado em `ui/form`) e `react-day-picker` mantidos. — ✅ **[§2.18]** `react-day-picker` (v8) passa a estar em uso real no novo `ui/date-field.tsx` (picker dos campos de data do `ActividadeUpsertModal`), deixando de ser peso morto.
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
5. **E4 — Hardening/auditoria**: helmet/rate-limit/CORS whitelist, remoção de código morto, PDF real, notificações socket/cron (opcional). (**✅ concluído o bloco principal** — helmet + express-rate-limit por camada (leituras 5000/15min, escritas 1000/15min, login 20/15min) + CORS whitelist por env; removidos `mockData.ts`/`seed.js` legados/`server/data`/`DATA_FILE` e deps não usadas (`react-query`, `react-table`, `zustand`, `supabase`, `zod`, `resolvers`); **lint a 0 erros** (16 corrigidos; 17 warnings documentados: `exhaustive-deps`×9, `only-export-components`×8). **Pendentes:** ❌/🔴 PDF real via pdfkit (§6 RF19), notificações socket/cron reais (§5 RF14/RF18), CI GitHub Actions, 17 warnings de lint.)
6. **E5 — Modelo por agendamento independente**: `DecisaoAgendamento` (log imutável) substitui `aprovacoes`+`aprovacao_agendamentos`; estado da atividade derivado das sessões; `num_participantes` no agendamento. (**✅ concluído** — migração aplicada no Neon com dados preservados; front: participantes e decisões por sessão.)
7. **E6 — Técnicos por sessão + estados derivados**: `AgendamentoTecnico` (validador+assistente obrigatórios por sessão na aprovação do Supervisor); `ActividadeEstado` fecha em `{pendente, em_andamento, rejeitada, realizada}`. (**✅ concluído** — migrações aplicadas no Neon; front com decisão imediata no modal para Rejeitar/Aprovar Supervisor.)
8. **E7 — Materiais por sessão**: `AgendamentoMaterial` (`@@unique [agendamento_id, material_id]`); `/actividades/full` recebe `agendamentos[].materiais[]`; balanço de stock somado por material. (**✅ concluído** — tabela recriada via `db push --force-reset`; RF14 inalterado.)
9. **E8 — Limites de participantes**: `laboratorios.capacidade` + `limites_participantes`; `utils/validarSessao.js`; `GET/PUT /configuracao/limites`. (**✅ concluído** — migração `20261010000000_capacidade_limites_participantes` aplicada por método manual; smoke test HTTP + unit `validarSessao`.)
10. **Correcções ao formulário de Actividades (§2.16)**: datas das sessões no futuro + dentro do período de projeto/estágio (backend `validarSessao(sessao, periodo)` + `periodoDaActividade`; front `min`/`max`), estágio sem título/descrição, responsável cinzento p/ não-Admin, materiais sem repetição por sessão. (**✅ concluído** — sem migração; smoke HTTP 23/23 + browser Playwright; `typecheck`/`lint` 0 erros.)

### 6.1. Método de migração (drift herdado — ler antes de novas migrações)

A base Neon **nunca teve `_prisma_migrations`**: o schema foi construído com `prisma db push` (E7 usou `--force-reset`). Como consequência, `prisma migrate dev` propõe *reset* e os ficheiros de migração antigos aparecem como **não aplicados** no `migrate status` (não reproduzem o schema actual).

**Método adoptado (E8 em diante):**
1. Escrever o `migration.sql` manualmente — **só** `ADD COLUMN` / `CREATE TABLE` / índices / constraints (nada destrutivo), alinhado com `schema.prisma`.
2. Aplicar com `prisma db execute --stdin` envolvido em `BEGIN; … COMMIT;`.
3. Marcar com `prisma migrate resolve --applied <nome>`.
4. Confirmar com `prisma migrate diff --from-config-datasource --to-schema server/prisma/schema.prisma --exit-code` → tem de sair **vazio**.

**Nunca** correr `migrate dev` nem `db push --force-reset` sobre esta base.
