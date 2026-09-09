import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import authRouter from './modules/auth.routes.js';
import utilizadoresRouter from './modules/utilizadores.routes.js';
import laboratoriosRouter from './modules/laboratorios.routes.js';
import cursosRouter from './modules/cursos.routes.js';
import { disciplinasRouter, cursoDisciplinasRouter, estudantesRouter } from './modules/academico.routes.js';
import materiaisRouter from './modules/materiais.routes.js';
import actividadesRouter from './modules/actividades.routes.js';
import { aulasRouter, visitasRouter, projectosRouter, estagiosRouter, atividadeTecnicoRouter, atividadeMateriaisRouter } from './modules/especializacoes.routes.js';
import agendamentosRouter from './modules/agendamentos.routes.js';
import aprovacoesFilaRouter, { historico as aprovacoesHistoricoRouter } from './modules/aprovacoes.routes.js';
import relatoriosRouter from './modules/relatorios.routes.js';
import { authRequired } from './middleware/auth.js';
import { getDb } from './db.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

initDb();

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Rotas por domínio (endpoints espelham spec 4.5)
app.use('/user', authRouter);
app.use('/user', utilizadoresRouter);
app.use('/cursos', cursosRouter);
app.use('/disciplinas', disciplinasRouter);
app.use('/curso-disciplinas', cursoDisciplinasRouter);
app.use('/estudantes', estudantesRouter);
app.use('/labs', laboratoriosRouter);
app.use('/materiais', materiaisRouter);
app.use('/actividades', actividadesRouter);
app.use('/actividades', aprovacoesHistoricoRouter);
app.use('/aulas', aulasRouter);
app.use('/visitas', visitasRouter);
app.use('/projectos', projectosRouter);
app.use('/estagios', estagiosRouter);
app.use('/actividade-tecnico', atividadeTecnicoRouter);
app.use('/actividade-materiais', atividadeMateriaisRouter);
app.use('/agendamentos', agendamentosRouter);
app.use('/aprovacoes', aprovacoesFilaRouter);
app.use('/relatorios', relatoriosRouter);

// Calendário (RF12) — ocupação mensal só aprovado_supervisor
app.get('/calendario', authRequired, (req, res) => {
  const db = getDb();
  let result = db.agendamentos.filter((g) => {
    const act = db.actividades.find((a) => a.id === g.actividade_id && a.activo !== false);
    return act && act.estado === 'aprovado_supervisor' && g.activo !== false;
  });
  if (req.query.laboratorio_id) result = result.filter((g) => g.laboratorio_id === Number(req.query.laboratorio_id));
  if (req.query.mes && req.query.ano) {
    const mes = Number(req.query.mes);
    const ano = Number(req.query.ano);
    result = result.filter((g) => {
      const d = new Date(g.hora_inicio);
      return d.getMonth() + 1 === mes && d.getFullYear() === ano;
    });
  }
  res.json(result);
});

// 404 para rotas desconhecidas
app.use((req, res) => res.status(404).json({ message: 'Rota não encontrada' }));

// Handler global de erros
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[erro]', err.message);
  res.status(500).json({ message: 'Erro interno do servidor' });
});

export default app;
