import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { prisma } from './db.js';
import { CORS_ORIGINS } from './config.js';
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
import configuracaoRouter from './modules/configuracao.routes.js';
import { unidadesLaboratoriaisRouter, categoriasMaterialRouter, unidadesRouter } from './modules/catalogos.routes.js';
import { authRequired } from './middleware/auth.js';

const app = express();

// Headers de segurança (helmet). crossOriginResourcePolicy desligado para não bloquear
// o download/visualização do PDF de relatórios a partir do front (outra origem em dev).
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS whitelist: dev (localhost), produção *.vercel.app e origens por env CORS_ORIGINS.
// Pedidos sem header Origin (curl, saúde, server-to-server) são sempre aceites.
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      try {
        const host = new URL(origin).hostname;
        if (host === 'localhost' || host.endsWith('.vercel.app') || CORS_ORIGINS.includes(origin)) {
          return cb(null, true);
        }
      } catch {
        // origem mal-formada cai no erro abaixo
      }
      const err = new Error('Origem não permitida (CORS)');
      err.status = 403;
      cb(err);
    },
  })
);
app.use(express.json({ limit: '2mb' }));

const janela = 15 * 60 * 1000;
const mensagem429 = { message: 'Demasiados pedidos, tente novamente mais tarde' };
const aoExceder = (req, res) => res.status(429).json(mensagem429);

// Rate-limit global da API (por instância; em serverless Vercel é por warm container)
app.use(rateLimit({ windowMs: janela, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false, handler: aoExceder }));
// Rate-limit reforçado no login
app.use('/user/login', rateLimit({ windowMs: janela, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, handler: aoExceder }));

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
app.use('/configuracao', configuracaoRouter);
app.use('/unidades-laboratoriais', unidadesLaboratoriaisRouter);
app.use('/categorias-material', categoriasMaterialRouter);
app.use('/unidades', unidadesRouter);

// Calendário (RF12) — ocupação mensal só de agendamentos aprovado_supervisor
app.get('/calendario', authRequired, async (req, res, next) => {
  try {
    const where = {
      activo: true,
      estado: 'aprovado_supervisor',
      actividade: { activo: true },
    };
    if (req.query.laboratorio_id) where.actividade.laboratorio_id = Number(req.query.laboratorio_id);
    if (req.query.de && req.query.ate) {
      const parse = (v) => {
        const [y, m, d] = String(v).split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
      };
      where.hora_inicio = { gte: parse(req.query.de), lt: parse(req.query.ate) };
    } else if (req.query.mes && req.query.ano) {
      const mes = Number(req.query.mes);
      const ano = Number(req.query.ano);
      where.hora_inicio = { gte: new Date(ano, mes - 1, 1), lt: new Date(ano, mes, 1) };
    }
    const rows = await prisma.agendamento.findMany({
      where,
      include: { actividade: { include: { laboratorio: true } } },
      orderBy: { id: 'asc' },
    });
    res.json(
      rows.map((g) => ({
        id: g.id,
        actividade_id: g.actividade_id,
        actividade_nome: g.actividade?.nome ?? '',
        laboratorio_id: g.actividade?.laboratorio_id,
        laboratorio_nome: g.actividade?.laboratorio?.nome ?? '',
        hora_inicio: g.hora_inicio,
        hora_fim: g.hora_fim,
        confirmado_professor_em: g.confirmado_professor_em,
        confirmado_tecnico_em: g.confirmado_tecnico_em,
        realizado: g.realizado,
        estado: g.estado,
        criado_em: g.criado_em,
        actualizado_em: g.actualizado_em,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// 404 para rotas desconhecidas
app.use((req, res) => res.status(404).json({ message: 'Rota não encontrada' }));

// Handler global de erros
app.use((err, req, res, next) => {
  console.error('[erro]', err.message);
  if (err.status) return res.status(err.status).json({ message: err.message });
  res.status(500).json({ message: 'Erro interno do servidor' });
});

export default app;