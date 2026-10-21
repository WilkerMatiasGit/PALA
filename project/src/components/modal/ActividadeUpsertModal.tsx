import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { actividadesService } from '@/services/actividades.service';
import { laboratoriosService } from '@/services/laboratorios.service';
import { utilizadoresService } from '@/services/utilizadores.service';
import { cursosService } from '@/services/cursos.service';
import { materiaisService } from '@/services/materiais.service';
import { agendamentosService } from '@/services/agendamentos.service';
import { configuracaoService } from '@/services/configuracao.service';
import { apiErrorMessage } from '@/services/api';
import { ACTIVIDADE_TIPO_OPTIONS, TURNO_TIPO_OPTIONS } from '@/services/enums';
import type { ActividadeGet, ActividadeUpsert, ActividadeFullUpsert, AulaGet, VisitaGet, ProjectoGet, EstagioGet } from '@/types/actividade.types';
import type { LimiteParticipantesGet } from '@/types/configuracao.types';
import type { LaboratorioGet } from '@/types/laboratorio.types';
import type { UtilizadorGet } from '@/types/utilizador.types';
import type { CursoDisciplinaGet } from '@/types/disciplina.types';
import type { MaterialOpcao } from '@/types/material.types';
import type { AgendamentoGet } from '@/types/agendamento.types';
import type { EstudanteGet } from '@/types/estudantes.types';
import type { ActividadeTipo } from '@/services/enums';
import { useAuth } from '@/context/AuthContext';
import { semestreToAno, semestreNoAno } from '@/utils/constants';
import { DIAS_SEMANA, diaDesactivado, diaSemana, fmtBR, hojeISO, paraISO, toDateInput } from '@/utils/dateInput';
import { DateField } from '@/components/ui/date-field';
import { Plus, Trash2, ChevronRight, ChevronLeft, ClipboardList } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actividade?: ActividadeGet | null;
  onSaved: () => void;
}

type AgendamentoBloc = {
  data: string;
  hora_inicio: string;
  hora_fim: string;
  num_participantes: string;
  materiais: MaterialReq[];
};
type MaterialReq = { material_id: number; quantidade_estimada: number };

const blocoVazio = (): AgendamentoBloc => ({
  data: '',
  hora_inicio: '',
  hora_fim: '',
  num_participantes: '1',
  materiais: [],
});

// Conversões e regras de datas vivem em @/utils/dateInput (partilhadas com o
// DateField; nunca usar `toISOString()` nem `new Date('aaaa-mm-dd')`).
const horaToMin = (h: string): number => {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + (mm || 0);
};

export function ActividadeUpsertModal({ open, onOpenChange, actividade, onSaved }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [labs, setLabs] = useState<LaboratorioGet[]>([]);
  const [users, setUsers] = useState<UtilizadorGet[]>([]);
  const [cursoDisciplinas, setCursoDisciplinas] = useState<CursoDisciplinaGet[]>([]);
  const [materiais, setMateriais] = useState<MaterialOpcao[]>([]);
  const [materiaisErro, setMateriaisErro] = useState('');
  const [existingAgendamentos, setExistingAgendamentos] = useState<AgendamentoGet[]>([]);
  const [estudantes, setEstudantes] = useState<EstudanteGet[]>([]);
  const [limites, setLimites] = useState<LimiteParticipantesGet[]>([]);
  // Configurações gerais (só leitura). null = ainda não carregado ou leitura falhou;
  // nesse caso NÃO bloqueamos o utilizador (o backend valida de qualquer forma).
  const [permitirFimSemana, setPermitirFimSemana] = useState<boolean | null>(null);
  const [configGeralErro, setConfigGeralErro] = useState('');

  // Step 1: base
  const [nome, setNome] = useState('');
  const [labId, setLabId] = useState('');
  const [tipo, setTipo] = useState<ActividadeTipo>('aula');
  const [observacoes, setObservacoes] = useState('');
  const [responsavelId, setResponsavelId] = useState('');

  // Só o Admin atribui o responsável de uma atividade (escolhe a partir da lista de
  // utilizadores). Para os restantes perfis o responsável é o próprio utilizador.
  const isAdmin = user?.tipo === 'admin';
  // Em edição: tipo e laboratório ficam bloqueados (regra 3); o responsável só o Admin altera.
  const isEdit = !!actividade;
  const responsavelOptions = users.filter((u) => {
    if (tipo === 'aula') return u.tipo === 'professor';
    return u.tipo === 'professor' || (user ? u.id === user.id : false);
  });

  // Step 2: type-specific
  // Aula
  const [cursoDisciplinaId, setCursoDisciplinaId] = useState('');
  const [tema, setTema] = useState('');
  const [turno, setTurno] = useState('');
  const [numeroTurma, setNumeroTurma] = useState('');
  // Visita
  const [nomeVisitante, setNomeVisitante] = useState('');
  const [instituicao, setInstituicao] = useState('');
  const [telefone, setTelefone] = useState('');
  const [emailVisitante, setEmailVisitante] = useState('');
  // Projeto/Estágio
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [estudanteId, setEstudanteId] = useState('');

  // Step 3: agendamentos (cada sessão tem o seu próprio nº de participantes e materiais)
  const [agendamentos, setAgendamentos] = useState<AgendamentoBloc[]>([blocoVazio()]);

  useEffect(() => {
    // Cada carregamento é independente: se um falhar, os restantes continuam a
    // popular as listas (incluindo a de laboratórios).
    laboratoriosService.list().then(setLabs).catch(() => setLabs([]));
    cursosService.listCursoDisciplinas().then(setCursoDisciplinas).catch(() => setCursoDisciplinas([]));
    cursosService.listEstudantes().then(setEstudantes).catch(() => setEstudantes([]));
    configuracaoService.getLimites().then(setLimites).catch(() => setLimites([]));
    // Configurações gerais (todos os perfis): o professor precisa de saber se os fins
    // de semana estão bloqueados para validar o formulário. Se falhar, mostra o erro
    // real e não bloqueia (o backend valida de qualquer forma).
    configuracaoService.getGeral()
      .then((c) => { setPermitirFimSemana(c.permitir_fim_semana); setConfigGeralErro(''); })
      .catch((err) => { setPermitirFimSemana(null); setConfigGeralErro(apiErrorMessage(err)); });
  }, []);

  // Lista de utilizadores (para escolher o responsável) — só o Admin tem acesso a
  // `GET /user` e é o único que atribui o responsável. Nos restantes perfis não se
  // faz o pedido (evita o 403 desnecessário); o responsável é o próprio utilizador.
  useEffect(() => {
    if (user?.tipo !== 'admin') { setUsers([]); return; }
    utilizadoresService.list().then(setUsers).catch(() => setUsers([]));
  }, [user?.tipo]);

  useEffect(() => {
    if (labId) {
      setMateriaisErro('');
      // Endpoint de leitura mínima (acessível também a professores); devolve só as opções
      // necessárias ao formulário. Em caso de erro, mostra a mensagem real ao utilizador.
      materiaisService.listOpcoes(Number(labId))
        .then(setMateriais)
        .catch((err) => { setMateriais([]); setMateriaisErro(apiErrorMessage(err)); });
      agendamentosService.list({ laboratorio_id: Number(labId) }).then(setExistingAgendamentos);
    } else {
      setMateriais([]);
      setMateriaisErro('');
      setExistingAgendamentos([]);
    }
  }, [labId]);

  // Ao abrir o modal: repõe o formulário e, em edição, pré-preenche TODOS os campos.
  // Nota: o preenchimento não pode viver no `onOpenChange` do Radix — este só é
  // disparado em interações internas (ex.: fechar), nunca quando o `open` é
  // controlado pelo componente pai (`setModalOpen(true)`). Daí o `useEffect` sobre `open`.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setNome(''); setLabId(''); setTipo('aula');
    setObservacoes(''); setResponsavelId('');
    setCursoDisciplinaId(''); setTema(''); setTurno(''); setNumeroTurma('');
    setNomeVisitante(''); setInstituicao(''); setTelefone(''); setEmailVisitante('');
    setTitulo(''); setDescricao(''); setDataInicio(''); setDataFim(''); setEstudanteId('');
    setAgendamentos([blocoVazio()]);

    if (!actividade) return;
    setNome(actividade.nome);
    setLabId(String(actividade.laboratorio_id));
    setTipo(actividade.tipo);
    setObservacoes(actividade.observacoes ?? '');
    setResponsavelId(String(actividade.responsavel_id));

    let cancelled = false;
    const detalhesReq =
      actividade.tipo === 'aula'
        ? actividadesService.getAula(actividade.id)
        : actividade.tipo === 'visita'
          ? actividadesService.getVisita(actividade.id)
          : actividade.tipo === 'projecto'
            ? actividadesService.getProjecto(actividade.id)
            : actividadesService.getEstagio(actividade.id);

    // O PUT /:id/full substitui os agendamentos — é preciso carregar os atuais e os seus materiais.
    Promise.all([
      agendamentosService.listByActividade(actividade.id),
      actividadesService.listMateriais(actividade.id).catch(() => []),
      detalhesReq.catch(() => null),
    ]).then(([ags, mats, det]) => {
      if (cancelled) return;
      if (det) {
        if (actividade.tipo === 'aula') {
          const d = det as AulaGet;
          setCursoDisciplinaId(d.curso_disciplina_id ? String(d.curso_disciplina_id) : '');
          setTema(d.tema ?? '');
          setTurno(d.turno ?? '');
          setNumeroTurma(d.numero_turma != null ? String(d.numero_turma) : '');
        } else if (actividade.tipo === 'visita') {
          const d = det as VisitaGet;
          setNomeVisitante(d.nome_visitante ?? '');
          setInstituicao(d.instituicao ?? '');
          setTelefone(d.telefone ?? '');
          setEmailVisitante(d.email ?? '');
        } else if (actividade.tipo === 'projecto') {
          const d = det as ProjectoGet;
          setTitulo(d.titulo ?? '');
          setDescricao(d.descricao ?? '');
          setDataInicio(toDateInput(d.data_inicio));
          setDataFim(toDateInput(d.data_fim));
        } else {
          const d = det as EstagioGet;
          setEstudanteId(d.estudante_id ? String(d.estudante_id) : '');
          setDataInicio(toDateInput(d.data_inicio));
          setDataFim(toDateInput(d.data_fim));
        }
      }
      if (ags.length === 0) return;
      setAgendamentos(
        ags.map((g) => {
          const inicio = new Date(g.hora_inicio);
          const fim = new Date(g.hora_fim);
          return {
            data: paraISO(inicio),
            hora_inicio: `${String(inicio.getHours()).padStart(2, '0')}:${String(inicio.getMinutes()).padStart(2, '0')}`,
            hora_fim: `${String(fim.getHours()).padStart(2, '0')}:${String(fim.getMinutes()).padStart(2, '0')}`,
            num_participantes: String(g.num_participantes ?? 1),
            materiais: mats
              .filter((m) => m.agendamento_id === g.id)
              .map((m) => ({ material_id: m.material_id, quantidade_estimada: m.quantidade_estimada })),
          };
        })
      );
    }).catch(() => setAgendamentos([blocoVazio()]));
    return () => { cancelled = true; };
  }, [open, actividade]);

  const handleOpenChange = (v: boolean) => onOpenChange(v);

  const getStepError = (s: number): string | null => {
    if (s === 1) return (!nome || !labId) ? 'Preencha o nome e o laboratório' : null;
    if (s === 2) {
      // Só o Admin escolhe o responsável; nos restantes perfis é o próprio utilizador.
      if (isAdmin && !responsavelId) return 'Selecione o responsável da atividade';
      if (tipo === 'aula') return !cursoDisciplinaId ? 'Selecione a disciplina' : null;
      if (tipo === 'visita') return (!nomeVisitante || !telefone || !emailVisitante) ? 'Preencha os dados do visitante' : null;
      if (tipo === 'projecto' || tipo === 'estagio') {
        if (tipo === 'projecto' && !titulo) return 'Preencha o título';
        if (!dataInicio || !dataFim) return 'Preencha as datas';
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const ini = new Date(dataInicio + 'T00:00:00');
        const fim = new Date(dataFim + 'T00:00:00');
        if (isNaN(ini.getTime()) || isNaN(fim.getTime())) return 'Datas inválidas';
        if (ini.getTime() < today.getTime()) return 'A data de início não pode estar no passado';
        if (fim.getTime() < ini.getTime()) return 'A data de fim não pode ser anterior à data de início';
      }
    }
    if (s === 3) {
      const filled = agendamentos.filter((a) => a.data && a.hora_inicio && a.hora_fim);
      if (filled.length === 0) return 'Adicione pelo menos uma sessão (dia + horas)';
      const currentActId = actividade?.id;
      const todayStr = hojeISO();
      // 1) cada bloco: dia não passado + hora fim > hora início + participantes >= 1
      for (const a of filled) {
        if (a.data < todayStr) return 'O dia da sessão não pode estar no passado';
        const pe = periodoError(a.data);
        if (pe) return pe;
        const fs = fimSemanaError(a.data);
        if (fs) return fs;
        if (a.hora_fim <= a.hora_inicio) return 'A hora de fim deve ser posterior à hora de início';
        if (!Number.isInteger(Number(a.num_participantes)) || Number(a.num_participantes) < 1) {
          return 'Indique o número de participantes (mínimo 1) em cada sessão';
        }
        const rErr = rangeError(Number(a.num_participantes));
        if (rErr) return rErr;
      }
      // 2) conflito entre blocos do próprio formulário (mesmo dia + sobreposição)
      for (let i = 0; i < filled.length; i++) {
        for (let j = i + 1; j < filled.length; j++) {
          const A = filled[i]; const B = filled[j];
          if (A.data === B.data) {
            if (horaToMin(A.hora_inicio) < horaToMin(B.hora_fim) && horaToMin(B.hora_inicio) < horaToMin(A.hora_fim)) {
              return 'As sessões selecionadas neste formulário sobrepõem-se';
            }
          }
        }
      }
      // 3) conflito com sessões já existentes no laboratório (mesmo dia + sobreposição)
      for (const a of filled) {
        const s = horaToMin(a.hora_inicio);
        const e = horaToMin(a.hora_fim);
        for (const g of existingAgendamentos) {
          if (currentActId && g.actividade_id === currentActId) continue;
          const go = new Date(g.hora_inicio);
          if (isNaN(go.getTime())) continue;
          if (paraISO(go) !== a.data) continue;
          const gs = go.getHours() * 60 + go.getMinutes();
          const gf = new Date(g.hora_fim);
          const ge = gf.getHours() * 60 + gf.getMinutes();
          if (s < ge && gs < e) return 'Conflito de horário com uma sessão já existente neste laboratório';
        }
      }
      return null;
    }
    return null;
  };

  // Intervalo de participantes permitido para o tipo/laboratório atuais.
  const labCap = labs.find((l) => String(l.id) === labId)?.capacidade;
  const limite = limites.find((l) => l.tipo === tipo) ?? null;
  const limiteActivo = !!limite?.limite_activo;
  const minPart = limite && limiteActivo ? limite.min : 1;
  const maxPart = limite
    ? (limiteActivo ? (labCap != null ? Math.min(labCap, limite.max) : limite.max) : labCap)
    : labCap;
  const labAbaixoMinimo = labCap != null && labCap < minPart;

  // Período do projeto/estágio (passo 2): limita as datas das sessões (passo 3).
  // Aula e visita não têm período.
  const isPeriodo = tipo === 'projecto' || tipo === 'estagio';
  const periodStart = isPeriodo ? dataInicio : '';
  const periodEnd = isPeriodo ? dataFim : '';

  // Regras de dias desactivados no calendário do dia da sessão (passo 3):
  // passado, fora do período (projeto/estágio) e fim de semana quando a regra
  // está desligada. min/max também são aplicados pelo próprio DateField.
  const diaSessaoDesactivado = (d: Date): boolean =>
    diaDesactivado(d, {
      hoje: hojeISO(),
      min: periodStart || hojeISO(),
      max: periodEnd || undefined,
      fimDeSemana: true,
      permitirFimSemana,
    });

  const rangeError = (participantes: number): string | null => {
    if (!Number.isInteger(participantes)) return null;
    if (participantes < minPart) return `Mínimo de participantes para ${ACTIVIDADE_TIPO_OPTIONS.find((o) => o.value === tipo)?.label ?? tipo}: ${minPart}`;
    if (maxPart != null && participantes > maxPart) {
      if (limiteActivo && limite && (labCap == null || limite.max <= labCap)) {
        return `Máximo de participantes para ${ACTIVIDADE_TIPO_OPTIONS.find((o) => o.value === tipo)?.label ?? tipo}: ${limite.max}`;
      }
      return `Máximo de participantes: capacidade do laboratório (${labCap})`;
    }
    return null;
  };

  // Erro de período (projeto/estágio): a sessão tem de estar dentro de [data_inicio, data_fim].
  const periodoError = (data: string): string | null => {
    if (!isPeriodo || !data) return null;
    if ((dataInicio && data < dataInicio) || (dataFim && data > dataFim)) {
      const nome = tipo === 'estagio' ? 'do estágio' : 'do projeto';
      return `A data da sessão (${fmtBR(data)}) está fora do período ${nome} (${fmtBR(dataInicio)} a ${fmtBR(dataFim)})`;
    }
    return null;
  };

  // Erro de fim de semana: só quando a configuração está carregada e desactivada
  // (`permitir_fim_semana === false`). Se a leitura falhou (null), não bloqueia.
  const fimSemanaError = (data: string): string | null => {
    if (permitirFimSemana !== false || !data) return null;
    const dow = diaSemana(data);
    if (dow === 0 || dow === 6) {
      return `Não é permitido agendar ao fim de semana (${fmtBR(data)} é ${DIAS_SEMANA[dow]}).`;
    }
    return null;
  };

  // Erros de data de uma sessão (passado / fora do período / fim de semana):
  // alimentam o texto do bloco e marcam o campo do dia como inválido.
  const dataError = (data: string): string | null => {
    if (!data) return null; // ainda não escolheu o dia
    if (data < hojeISO()) return 'O dia não pode estar no passado';
    const pe = periodoError(data);
    if (pe) return pe;
    return fimSemanaError(data);
  };

  // Erro específico de um bloco de agendamento para validação em tempo real
  const blocoError = (a: AgendamentoBloc): string | null => {
    const de = dataError(a.data);
    if (de) return de;
    if (!a.hora_inicio || !a.hora_fim) return 'Indique a hora de início e de fim';
    if (a.hora_fim <= a.hora_inicio) return 'A hora de fim deve ser posterior à hora de início';
    if (!Number.isInteger(Number(a.num_participantes)) || Number(a.num_participantes) < 1) {
      return 'Nº de participantes inválido (mínimo 1)';
    }
    return rangeError(Number(a.num_participantes));
  };

  const handleSubmit = async () => {
    const passo3 = getStepError(3);
    if (passo3) { toast.error(passo3); return; }
    for (const a of agendamentos) {
      if (!a.data || !a.hora_inicio || !a.hora_fim) continue;
      for (const m of a.materiais) {
        if (!m.material_id || m.quantidade_estimada < 1) {
          toast.error('Escolha o material e uma quantidade (mínimo 1) em cada sessão');
          return;
        }
      }
    }
    setSaving(true);
    try {
      const actData: ActividadeUpsert = {
        nome,
        responsavel_id: Number(responsavelId || (actividade?.responsavel_id ?? user?.id ?? 1)),
        laboratorio_id: Number(labId),
        observacoes,
        tipo,
      };

      const detalhes =
        tipo === 'aula'
          ? { curso_disciplina_id: Number(cursoDisciplinaId), tema, turno, numero_turma: Number(numeroTurma) }
          : tipo === 'visita'
            ? { nome_visitante: nomeVisitante, telefone, email: emailVisitante, ...(instituicao ? { instituicao } : {}) }
            : tipo === 'projecto'
              ? { titulo, descricao, data_inicio: dataInicio, data_fim: dataFim }
              : { estudante_id: Number(estudanteId), data_inicio: dataInicio, data_fim: dataFim };

      const payload: ActividadeFullUpsert = {
        ...actData,
        detalhes,
        agendamentos: agendamentos
          .filter((a) => a.data && a.hora_inicio && a.hora_fim)
          .map((a) => ({
            hora_inicio: `${a.data}T${a.hora_inicio}`,
            hora_fim: `${a.data}T${a.hora_fim}`,
            num_participantes: Number(a.num_participantes),
            materiais: a.materiais
              .filter((m) => m.material_id > 0 && m.quantidade_estimada > 0)
              .map((m) => ({ material_id: m.material_id, quantidade_estimada: m.quantidade_estimada })),
          })),
      };

      // Envio único (atómico no backend): atividade + detalhes + agendamentos + materiais
      if (actividade) {
        await actividadesService.updateFull(actividade.id, payload);
      } else {
        await actividadesService.createFull(payload);
      }

      toast.success(actividade ? 'Actividade atualizada' : 'Actividade criada');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const stepLabels = ['Dados Base', 'Detalhes', 'Agendamentos', 'Materiais'];

  const selectedCd = cursoDisciplinas.find((cd) => String(cd.id) === cursoDisciplinaId);
  const aulaAno = selectedCd ? semestreToAno(selectedCd.semestre) : null;
  const turmaPreview = selectedCd && turno && numeroTurma && Number(numeroTurma) > 0
    ? `${selectedCd.curso_abreviacao}_${turno === 'manha' ? 'M' : 'T'}${numeroTurma}`
    : '';

  // O Radix só mostra o item selecionado no trigger se o dropdown já tiver sido aberto
  // (o texto do item é portalado para o value node nesse momento). Em edição os valores
  // são definidos programaticamente e o dropdown nunca abre — daí passarmos o rótulo
  // explicitamente como children de <SelectValue> (API suportada pelo Radix).
  const labLabel = labs.find((l) => String(l.id) === labId)?.nome ?? '';
  const tipoLabel = ACTIVIDADE_TIPO_OPTIONS.find((o) => o.value === tipo)?.label ?? '';
  const responsavelLabel = users.find((u) => String(u.id) === responsavelId)?.nome ?? '';
  const turnoLabel = TURNO_TIPO_OPTIONS.find((o) => o.value === turno)?.label ?? '';
  const cdLabel = (cd: CursoDisciplinaGet) =>
    `${cd.disciplina_nome} (${cd.curso_nome} - ${semestreToAno(cd.semestre)}º Ano · ${semestreNoAno(cd.semestre)}º Sem)`;
  const disciplinaLabel = selectedCd ? cdLabel(selectedCd) : '';
  const estudanteLabel = estudantes.find((e) => String(e.id) === estudanteId)?.nome ?? '';
  const materialLabel = (id: number | string) => {
    const m = materiais.find((x) => String(x.id) === String(id));
    return m ? `${m.nome} (${m.quantidade} ${m.unidade})` : '';
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{actividade ? 'Editar Actividade' : 'Nova Actividade'}</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${step > i + 1 ? 'bg-primary text-primary-foreground' : step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {i + 1}
              </div>
              {i < stepLabels.length - 1 && <div className={`h-px w-8 ${step > i + 1 ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Base data */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="act-nome">Nome da actividade</Label>
              <Input id="act-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Laboratório</Label>
                <Select value={labId} onValueChange={setLabId} disabled={isEdit}>
                  <SelectTrigger><SelectValue placeholder="Selecionar...">{labLabel}</SelectValue></SelectTrigger>
                  <SelectContent>{labs.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nome}</SelectItem>)}</SelectContent>
                </Select>
                {isEdit && <p className="text-xs text-muted-foreground">O laboratório não pode ser alterado.</p>}
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as ActividadeTipo)} disabled={isEdit}>
                  <SelectTrigger><SelectValue>{tipoLabel}</SelectValue></SelectTrigger>
                  <SelectContent>{ACTIVIDADE_TIPO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                {isEdit && <p className="text-xs text-muted-foreground">O tipo não pode ser alterado.</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>
          </div>
        )}

        {/* Step 2: Type-specific */}
        {step === 2 && (
          <div className="space-y-4">
            <Badge variant="secondary">{ACTIVIDADE_TIPO_OPTIONS.find((o) => o.value === tipo)?.label}</Badge>
            {isEdit ? (
              isAdmin ? (
                <div className="space-y-2">
                  <Label htmlFor="act-responsavel">Responsável da atividade</Label>
                  <Select value={responsavelId} onValueChange={setResponsavelId}>
                    <SelectTrigger id="act-responsavel"><SelectValue placeholder="Selecionar...">{responsavelLabel}</SelectValue></SelectTrigger>
                    <SelectContent>{responsavelOptions.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Só o Admin pode alterar o responsável.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="act-responsavel">Responsável da atividade</Label>
                  <Select value={responsavelId} disabled>
                    <SelectTrigger id="act-responsavel"><SelectValue placeholder="Selecionar...">{responsavelLabel || actividade?.responsavel_nome || ''}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {responsavelId && (
                        <SelectItem value={responsavelId}>{responsavelLabel || actividade?.responsavel_nome}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Só o Admin pode alterar o responsável.</p>
                </div>
              )
            ) : isAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="act-responsavel">Responsável da atividade</Label>
                <Select value={responsavelId} onValueChange={setResponsavelId}>
                  <SelectTrigger id="act-responsavel"><SelectValue placeholder="Selecionar...">{responsavelLabel}</SelectValue></SelectTrigger>
                  <SelectContent>{responsavelOptions.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {tipo === 'aula' ? 'Nas aulas, o responsável tem de ser obrigatoriamente um professor.' : 'O responsável pode ser o próprio utilizador ou um professor.'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border px-3 py-2 text-sm">
                <span className="text-muted-foreground">Responsável: </span><span className="font-medium">{user?.nome} (você)</span>
              </div>
            )}
            {tipo === 'aula' && (
              <>
                <div className="space-y-2">
                  <Label>Disciplina (Curso-Disciplina)</Label>
                  <Select value={cursoDisciplinaId} onValueChange={setCursoDisciplinaId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar...">{disciplinaLabel}</SelectValue></SelectTrigger>
                    <SelectContent>{cursoDisciplinas.map((cd) => <SelectItem key={cd.id} value={String(cd.id)}>{cdLabel(cd)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {aulaAno != null && (
                  <div className="space-y-2">
                    <Label>Ano letivo</Label>
                    <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">{aulaAno}º Ano</div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Turno</Label>
                    <Select value={turno} onValueChange={setTurno}>
                      <SelectTrigger><SelectValue placeholder="Selecionar turno...">{turnoLabel}</SelectValue></SelectTrigger>
                      <SelectContent>{TURNO_TIPO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="num-turma">Nº da turma</Label>
                    <NumberInput id="num-turma" value={numeroTurma} onValueChange={setNumeroTurma} placeholder="Ex: 1" />
                  </div>
                </div>
                {turmaPreview && (
                  <div className="space-y-2">
                    <Label>Turma (gerada)</Label>
                    <div className="rounded-md border px-3 py-2 font-mono text-sm text-primary">{turmaPreview}</div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="tema">Tema</Label>
                  <Input id="tema" value={tema} onChange={(e) => setTema(e.target.value)} />
                </div>
              </>
            )}
            {tipo === 'visita' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="vis-nome">Nome do visitante</Label>
                  <Input id="vis-nome" required value={nomeVisitante} onChange={(e) => setNomeVisitante(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vis-inst">Instituição de origem</Label>
                  <Input id="vis-inst" value={instituicao} onChange={(e) => setInstituicao(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vis-tel">Telefone</Label>
                    <Input id="vis-tel" required value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vis-email">Email</Label>
                    <Input id="vis-email" type="email" required value={emailVisitante} onChange={(e) => setEmailVisitante(e.target.value)} />
                  </div>
                </div>
              </>
            )}
            {(tipo === 'projecto' || tipo === 'estagio') && (
              <>
                {tipo === 'projecto' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="proj-titulo">Título</Label>
                      <Input id="proj-titulo" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proj-desc">Descrição</Label>
                      <Textarea id="proj-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data-ini">Data início</Label>
                    <DateField
                      id="data-ini"
                      aria-label="Data início"
                      required
                      min={hojeISO()}
                      value={dataInicio}
                      onChange={setDataInicio}
                      invalid={!!dataInicio && dataInicio < hojeISO()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data-fim">Data fim</Label>
                    <DateField
                      id="data-fim"
                      aria-label="Data fim"
                      required
                      min={dataInicio || hojeISO()}
                      value={dataFim}
                      onChange={setDataFim}
                      invalid={!!dataFim && (dataFim < hojeISO() || !!(dataInicio && dataFim < dataInicio))}
                    />
                  </div>
                </div>
                {tipo === 'estagio' && (
                  <div className="space-y-2">
                    <Label>Estudante</Label>
                    <Select value={estudanteId} onValueChange={setEstudanteId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar estudante...">{estudanteLabel}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {estudantes.map((est) => <SelectItem key={est.id} value={String(est.id)}>{est.nome} ({est.id})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Agendamentos */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Adicione as sessões: escolha primeiro o dia e, em seguida, o intervalo de horas dentro desse dia. O
              número de participantes é definido por sessão.
            </p>
            {labAbaixoMinimo && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
                A capacidade do laboratório ({labCap}) é inferior ao mínimo de {ACTIVIDADE_TIPO_OPTIONS.find((o) => o.value === tipo)?.label ?? tipo} ({minPart}). Não é possível criar sessões deste tipo neste laboratório.
              </p>
            )}
            {permitirFimSemana === false && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
                Fins de semana não permitidos.
              </p>
            )}
            {configGeralErro && (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
                Não foi possível ler as regras de agendamento: {configGeralErro}
              </p>
            )}
            {agendamentos.map((ag, i) => {
              const err = blocoError(ag);
              return (
                <Card key={i}>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-40 space-y-1">
                        <Label className="text-xs">Dia</Label>
                        <DateField
                          aria-label="Dia da sessão"
                          min={periodStart || hojeISO()}
                          max={periodEnd || undefined}
                          isDayDisabled={diaSessaoDesactivado}
                          value={ag.data}
                          invalid={!!dataError(ag.data)}
                          onChange={(v) => {
                            const copy = [...agendamentos]; copy[i].data = v; setAgendamentos(copy);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Início</Label>
                        <Input type="time" value={ag.hora_inicio} onChange={(e) => {
                          const copy = [...agendamentos]; copy[i].hora_inicio = e.target.value; setAgendamentos(copy);
                        }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Fim</Label>
                        <Input type="time" value={ag.hora_fim} onChange={(e) => {
                          const copy = [...agendamentos]; copy[i].hora_fim = e.target.value; setAgendamentos(copy);
                        }} />
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs">Nº participantes</Label>
                        <NumberInput value={ag.num_participantes} onValueChange={(v) => {
                          const copy = [...agendamentos]; copy[i].num_participantes = v; setAgendamentos(copy);
                        }} min={1} />
                        {maxPart != null && (
                          <p className="text-[11px] text-muted-foreground">Mín. {minPart} · Máx. {maxPart}</p>
                        )}
                      </div>
                      {agendamentos.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => setAgendamentos(agendamentos.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    {err && <p className="text-sm font-medium text-destructive">{err}</p>}
                  </CardContent>
                </Card>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setAgendamentos([...agendamentos, blocoVazio()])}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar sessão
            </Button>
          </div>
        )}

        {/* Step 4: Materiais (por sessão) */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecione os materiais do laboratório e a quantidade estimada por sessão (opcional).</p>
            {materiaisErro ? (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
                Não foi possível carregar os materiais: {materiaisErro}
              </p>
            ) : !labId ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Selecione um laboratório no passo 1 para ver os materiais disponíveis.</p>
              </div>
            ) : materiais.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este laboratório não tem materiais registados.</p>
            ) : agendamentos.filter((a) => a.data && a.hora_inicio && a.hora_fim).length === 0 ? (
              <p className="text-sm text-muted-foreground">Adicione sessões no passo anterior para lhes associar materiais.</p>
            ) : (
              agendamentos.map((ag, i) => {
                if (!ag.data || !ag.hora_inicio || !ag.hora_fim) return null;
                return (
                  <Card key={i}>
                    <CardContent className="space-y-3 pt-4">
                      <Badge variant="secondary">{ag.data} · {ag.hora_inicio}–{ag.hora_fim}</Badge>
                      {ag.materiais.map((mr, j) => (
                        <div key={j} className="flex items-end gap-2">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Material</Label>
                            <Select value={mr.material_id > 0 ? String(mr.material_id) : ''} onValueChange={(v) => {
                              const copy = [...agendamentos]; copy[i].materiais[j].material_id = Number(v); setAgendamentos(copy);
                            }}>
                              <SelectTrigger><SelectValue placeholder="Selecionar...">{materialLabel(mr.material_id)}</SelectValue></SelectTrigger>
                              <SelectContent>
                                {materiais
                                  .filter((m) => !ag.materiais.some((outro, idx) => idx !== j && outro.material_id === m.id))
                                  .map((m) => <SelectItem key={m.id} value={String(m.id)}>{materialLabel(m.id)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-24 space-y-1">
                            <Label className="text-xs">Qtd. estimada</Label>
                            <NumberInput min={1} value={mr.quantidade_estimada > 0 ? String(mr.quantidade_estimada) : ''} onValueChange={(v) => {
                              const copy = [...agendamentos]; copy[i].materiais[j].quantidade_estimada = v === '' ? 0 : Number(v); setAgendamentos(copy);
                            }} />
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => {
                            const copy = [...agendamentos]; copy[i].materiais = copy[i].materiais.filter((_, idx) => idx !== j); setAgendamentos(copy);
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => {
                        const copy = [...agendamentos]; copy[i].materiais = [...copy[i].materiais, { material_id: 0, quantidade_estimada: 1 }]; setAgendamentos(copy);
                      }}>
                        <Plus className="mr-2 h-4 w-4" /> Adicionar material
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}>
            {step > 1 ? <><ChevronLeft className="mr-1 h-4 w-4" /> Anterior</> : 'Cancelar'}
          </Button>
          {step < 4 ? (
            <Button onClick={() => { const err = getStepError(step); if (err) toast.error(err); else setStep(step + 1); }}>
              Próximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Spinner className="mr-2" /> : null}
              {actividade ? 'Guardar' : 'Criar'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
