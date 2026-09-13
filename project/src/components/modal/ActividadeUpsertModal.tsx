import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { actividadesService } from '@/services/actividades.service';
import { laboratoriosService } from '@/services/laboratorios.service';
import { utilizadoresService } from '@/services/utilizadores.service';
import { cursosService } from '@/services/cursos.service';
import { materiaisService } from '@/services/materiais.service';
import { agendamentosService } from '@/services/agendamentos.service';
import { ACTIVIDADE_TIPO_OPTIONS } from '@/services/enums';
import type { ActividadeGet, ActividadeUpsert, ActividadeFullUpsert } from '@/types/actividade.types';
import type { LaboratorioGet } from '@/types/laboratorio.types';
import type { UtilizadorGet } from '@/types/utilizador.types';
import type { CursoDisciplinaGet } from '@/types/disciplina.types';
import type { MaterialGet } from '@/types/material.types';
import type { AgendamentoGet } from '@/types/agendamento.types';
import type { EstudanteGet } from '@/types/estudantes.types';
import type { ActividadeTipo } from '@/services/enums';
import { useAuth } from '@/context/AuthContext';
import { Plus, Trash2, ChevronRight, ChevronLeft, ClipboardList } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actividade?: ActividadeGet | null;
  onSaved: () => void;
}

type AgendamentoBloc = { data: string; hora_inicio: string; hora_fim: string };
type MaterialReq = { material_id: number; quantidade_estimada: number };

const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const hojeISO = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toISODate(d);
};

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
  const [materiais, setMateriais] = useState<MaterialGet[]>([]);
  const [existingAgendamentos, setExistingAgendamentos] = useState<AgendamentoGet[]>([]);
  const [estudantes, setEstudantes] = useState<EstudanteGet[]>([]);

  // Step 1: base
  const [nome, setNome] = useState('');
  const [labId, setLabId] = useState('');
  const [tipo, setTipo] = useState<ActividadeTipo>('aula');
  const [numParticipantes, setNumParticipantes] = useState('1');
  const [precisaAssistente, setPrecisaAssistente] = useState(false);
  const [observacoes, setObservacoes] = useState('');

  // Step 2: type-specific
  // Aula
  const [cursoDisciplinaId, setCursoDisciplinaId] = useState('');
  const [tema, setTema] = useState('');
  // Visita
  const [nomeVisitante, setNomeVisitante] = useState('');
  const [instituicao, setInstituicao] = useState('');
  const [telefone, setTelefone] = useState('');
  const [emailVisitante, setEmailVisitante] = useState('');
  // Projeto/Estágio
  const [responsavelId, setResponsavelId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [estudanteId, setEstudanteId] = useState('');

  // Step 3: agendamentos
  const [agendamentos, setAgendamentos] = useState<AgendamentoBloc[]>([{ data: '', hora_inicio: '', hora_fim: '' }]);

  // Step 4: materiais
  const [materialReqs, setMaterialReqs] = useState<MaterialReq[]>([]);

  useEffect(() => {
    // Cada carregamento é independente: se um falhar (ex: /user é só admin),
    // os restantes continuam a popular as listas (incluindo a de laboratórios).
    laboratoriosService.list().then(setLabs).catch(() => setLabs([]));
    cursosService.listCursoDisciplinas().then(setCursoDisciplinas).catch(() => setCursoDisciplinas([]));
    cursosService.listEstudantes().then(setEstudantes).catch(() => setEstudantes([]));
    utilizadoresService.list().then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (labId) {
      materiaisService.list({ laboratorio_id: Number(labId) }).then(setMateriais);
      agendamentosService.list({ laboratorio_id: Number(labId) }).then(setExistingAgendamentos);
    } else {
      setMateriais([]);
      setExistingAgendamentos([]);
    }
  }, [labId]);

  const resetForm = () => {
    setStep(1);
    setNome(''); setLabId(''); setTipo('aula'); setNumParticipantes('1');
    setPrecisaAssistente(false); setObservacoes('');
    setCursoDisciplinaId(''); setTema('');
    setNomeVisitante(''); setInstituicao(''); setTelefone(''); setEmailVisitante('');
    setResponsavelId(''); setTitulo(''); setDescricao(''); setDataInicio(''); setDataFim(''); setEstudanteId('');
    setAgendamentos([{ data: '', hora_inicio: '', hora_fim: '' }]);
    setMaterialReqs([]);
  };

  const handleOpenChange = (v: boolean) => {
    if (v) {
      resetForm();
      if (actividade) {
        setNome(actividade.nome); setLabId(String(actividade.laboratorio_id));
        setTipo(actividade.tipo); setNumParticipantes(String(actividade.num_participantes));
        setPrecisaAssistente(actividade.precisa_assistente); setObservacoes(actividade.observacoes);
      }
    }
    onOpenChange(v);
  };

  const getStepError = (s: number): string | null => {
    if (s === 1) return (!nome || !labId) ? 'Preencha o nome e o laboratório' : null;
    if (s === 2) {
      if (tipo === 'aula') return !cursoDisciplinaId ? 'Selecione a disciplina' : null;
      if (tipo === 'visita') return (!nomeVisitante || !telefone || !emailVisitante) ? 'Preencha os dados do visitante' : null;
      if (tipo === 'projecto' || tipo === 'estagio') {
        if (!responsavelId || !titulo || !dataInicio || !dataFim) return 'Preencha o responsável, título e as datas';
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
      // 1) cada bloco: dia não passado + hora fim > hora início
      for (const a of filled) {
        if (a.data < todayStr) return 'O dia da sessão não pode estar no passado';
        if (a.hora_fim <= a.hora_inicio) return 'A hora de fim deve ser posterior à hora de início';
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
          if (toISODate(go) !== a.data) continue;
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

  const validateStep = (s: number): boolean => getStepError(s) === null;

  // Erro específico de um bloco de agendamento para validação em tempo real
  const blocoError = (a: AgendamentoBloc): string | null => {
    if (!a.data) return null; // ainda não escolheu o dia
    if (a.data < hojeISO()) return 'O dia não pode estar no passado';
    if (!a.hora_inicio || !a.hora_fim) return 'Indique a hora de início e de fim';
    if (a.hora_fim <= a.hora_inicio) return 'A hora de fim deve ser posterior à hora de início';
    return null;
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const actData: ActividadeUpsert = {
        nome,
        utilizador_id: actividade?.utilizador_id ?? user?.id ?? 1,
        laboratorio_id: Number(labId),
        num_participantes: Number(numParticipantes),
        observacoes,
        precisa_assistente: precisaAssistente,
        tipo,
      };

      const detalhes =
        tipo === 'aula'
          ? { curso_disciplina_id: Number(cursoDisciplinaId), tema }
          : tipo === 'visita'
            ? { nome_visitante: nomeVisitante, telefone, email: emailVisitante, ...(instituicao ? { instituicao } : {}) }
            : tipo === 'projecto'
              ? { responsavel_id: Number(responsavelId), titulo, descricao, data_inicio: dataInicio, data_fim: dataFim }
              : { responsavel_id: Number(responsavelId), estudante_id: Number(estudanteId), data_inicio: dataInicio, data_fim: dataFim };

      const payload: ActividadeFullUpsert = {
        ...actData,
        detalhes,
        agendamentos: agendamentos
          .filter((a) => a.data && a.hora_inicio && a.hora_fim)
          .map((a) => ({ hora_inicio: `${a.data}T${a.hora_inicio}`, hora_fim: `${a.data}T${a.hora_fim}` })),
        materiais: materialReqs.map((m) => ({ material_id: m.material_id, quantidade_estimada: m.quantidade_estimada })),
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
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar actividade');
    } finally {
      setSaving(false);
    }
  };

  const stepLabels = ['Dados Base', 'Detalhes', 'Agendamentos', 'Materiais'];

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
                <Select value={labId} onValueChange={setLabId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{labs.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as ActividadeTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTIVIDADE_TIPO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="num-part">Nº participantes</Label>
                <Input id="num-part" type="number" min={1} value={numParticipantes} onChange={(e) => setNumParticipantes(e.target.value)} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={precisaAssistente} onCheckedChange={setPrecisaAssistente} />
                <Label>Precisa de assistente</Label>
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
            {tipo === 'aula' && (
              <>
                <div className="space-y-2">
                  <Label>Disciplina (Curso-Disciplina)</Label>
                  <Select value={cursoDisciplinaId} onValueChange={setCursoDisciplinaId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{cursoDisciplinas.map((cd) => <SelectItem key={cd.id} value={String(cd.id)}>{cd.disciplina_nome} ({cd.curso_nome} - {cd.semestre}º Sem)</SelectItem>)}</SelectContent>
                  </Select>
                </div>
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
                <div className="space-y-2">
                  <Label>Professor responsável</Label>
                  <Select value={responsavelId} onValueChange={setResponsavelId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{users.filter((u) => u.tipo === 'professor' || u.tipo === 'admin').map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proj-titulo">Título</Label>
                  <Input id="proj-titulo" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proj-desc">Descrição</Label>
                  <Textarea id="proj-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data-ini">Data início</Label>
                    <Input id="data-ini" type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data-fim">Data fim</Label>
                    <Input id="data-fim" type="date" required value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                  </div>
                </div>
                {tipo === 'estagio' && (
                  <div className="space-y-2">
                    <Label>Estudante</Label>
                    <Select value={estudanteId} onValueChange={setEstudanteId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar estudante..." /></SelectTrigger>
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
            <p className="text-sm text-muted-foreground">Adicione as sessões: escolha primeiro o dia e, em seguida, o intervalo de horas dentro desse dia.</p>
            {agendamentos.map((ag, i) => {
              const err = blocoError(ag);
              return (
                <Card key={i}>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex items-end gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Dia</Label>
                        <Input type="date" min={hojeISO()} value={ag.data} onChange={(e) => {
                          const copy = [...agendamentos]; copy[i].data = e.target.value; setAgendamentos(copy);
                        }} />
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
            <Button variant="outline" size="sm" onClick={() => setAgendamentos([...agendamentos, { data: '', hora_inicio: '', hora_fim: '' }])}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar sessão
            </Button>
          </div>
        )}

        {/* Step 4: Materiais */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecione os materiais do laboratório e a quantidade estimada por sessão (opcional).</p>
            {materiais.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Selecione um laboratório no passo 1 para ver os materiais disponíveis.</p>
              </div>
            ) : (
              <>
                {materialReqs.map((mr, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Material</Label>
                      <Select value={String(mr.material_id)} onValueChange={(v) => {
                        const copy = [...materialReqs]; copy[i].material_id = Number(v); setMaterialReqs(copy);
                      }}>
                        <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>{materiais.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.nome} ({m.quantidade} {m.unidade})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-xs">Qtd. estimada</Label>
                      <Input type="number" min={1} value={mr.quantidade_estimada} onChange={(e) => {
                        const copy = [...materialReqs]; copy[i].quantidade_estimada = Number(e.target.value); setMaterialReqs(copy);
                      }} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setMaterialReqs(materialReqs.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setMaterialReqs([...materialReqs, { material_id: 0, quantidade_estimada: 1 }])}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar material
                </Button>
              </>
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
