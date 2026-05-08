import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  INTAKE_CHECKLIST_GROUPS,
  INTAKE_CHECKLIST_ITEMS,
  INTAKE_CHECKLIST_REASON_LABELS,
  defaultIntakeChecklist,
  type IntakeChecklistData,
  type IntakeChecklistItemKey,
  type IntakeChecklistItemStatus,
  type IntakeChecklistReason,
} from './types';
import type { RepairOrderInput } from './schemas';
import { cn } from '@/lib/utils';

interface Props {
  register: UseFormRegister<RepairOrderInput>;
  watch: UseFormWatch<RepairOrderInput>;
  setValue: UseFormSetValue<RepairOrderInput>;
  errors: FieldErrors<RepairOrderInput>;
}

type AppliesMode = 'unset' | 'yes' | 'no';

function readApplies(v: boolean | null | undefined): AppliesMode {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return 'unset';
}

const ITEM_LABELS: Record<IntakeChecklistItemKey, string> = INTAKE_CHECKLIST_ITEMS.reduce(
  (acc, it) => ({ ...acc, [it.key]: it.label }),
  {} as Record<IntakeChecklistItemKey, string>,
);

export default function IntakeChecklistFields({
  register,
  watch,
  setValue,
  errors,
}: Props) {
  const appliesRaw = watch('intake_checklist_applies');
  const applies = readApplies(appliesRaw);
  const reason = watch('intake_checklist_reason');
  const reasonOther = watch('intake_checklist_reason_other');
  const checklist = watch('intake_checklist');

  const handleAppliesChange = (mode: AppliesMode) => {
    if (mode === 'yes') {
      setValue('intake_checklist_applies', true, { shouldDirty: true, shouldValidate: true });
      setValue('intake_checklist_reason', null, { shouldDirty: true });
      setValue('intake_checklist_reason_other', null, { shouldDirty: true });
      if (!checklist) {
        setValue('intake_checklist', defaultIntakeChecklist(), { shouldDirty: true });
      }
    } else if (mode === 'no') {
      setValue('intake_checklist_applies', false, { shouldDirty: true, shouldValidate: true });
      setValue('intake_checklist', null, { shouldDirty: true });
    } else {
      setValue('intake_checklist_applies', null, { shouldDirty: true, shouldValidate: true });
      setValue('intake_checklist', null, { shouldDirty: true });
      setValue('intake_checklist_reason', null, { shouldDirty: true });
      setValue('intake_checklist_reason_other', null, { shouldDirty: true });
    }
  };

  const setItem = (key: IntakeChecklistItemKey, value: IntakeChecklistItemStatus) => {
    const current = checklist ?? defaultIntakeChecklist();
    setValue(
      'intake_checklist',
      { ...current, [key]: value },
      { shouldDirty: true },
    );
  };

  const setBattery = (raw: string) => {
    const current = checklist ?? defaultIntakeChecklist();
    if (raw === '') {
      setValue('intake_checklist', { ...current, bateria_porcentaje: null }, { shouldDirty: true });
      return;
    }
    const n = parseInt(raw, 10);
    setValue(
      'intake_checklist',
      { ...current, bateria_porcentaje: Number.isFinite(n) ? n : null },
      { shouldDirty: true },
    );
  };

  const setFunda = (v: boolean) => {
    const current = checklist ?? defaultIntakeChecklist();
    setValue('intake_checklist', { ...current, trae_funda: v }, { shouldDirty: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist de ingreso</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>¿Se hizo revisión al recibir el equipo?</Label>
          <div
            role="radiogroup"
            aria-label="¿Se hizo revisión al recibir el equipo?"
            className="inline-flex rounded-md border border-input bg-secondary p-0.5 text-sm"
          >
            {(
              [
                { v: 'unset', label: 'Sin definir' },
                { v: 'yes', label: 'Aplica' },
                { v: 'no', label: 'No aplica' },
              ] as { v: AppliesMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                role="radio"
                aria-checked={applies === opt.v}
                onClick={() => handleAppliesChange(opt.v)}
                className={cn(
                  'rounded px-3 py-1.5 transition',
                  applies === opt.v
                    ? 'bg-background text-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {applies === 'no' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Razón</Label>
              <Select
                value={reason ?? ''}
                onValueChange={(v) =>
                  setValue('intake_checklist_reason', v as IntakeChecklistReason, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(INTAKE_CHECKLIST_REASON_LABELS) as IntakeChecklistReason[]).map(
                    (k) => (
                      <SelectItem key={k} value={k}>
                        {INTAKE_CHECKLIST_REASON_LABELS[k]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              {errors.intake_checklist_reason && (
                <p className="text-xs text-destructive">
                  {errors.intake_checklist_reason.message}
                </p>
              )}
            </div>
            {reason === 'otro' && (
              <div className="space-y-2">
                <Label htmlFor="intake_checklist_reason_other">Describe la razón</Label>
                <Textarea
                  id="intake_checklist_reason_other"
                  rows={2}
                  value={reasonOther ?? ''}
                  onChange={(e) =>
                    setValue('intake_checklist_reason_other', e.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                {errors.intake_checklist_reason_other && (
                  <p className="text-xs text-destructive">
                    {errors.intake_checklist_reason_other.message}
                  </p>
                )}
              </div>
            )}
            {reason && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium text-amber-200">⚠️ Aviso</p>
                <p className="mt-1 text-xs text-amber-100/90">{disclaimerFor(reason)}</p>
              </div>
            )}
          </div>
        )}

        {applies === 'yes' && (
          <ChecklistEditor
            checklist={checklist ?? defaultIntakeChecklist()}
            onChangeItem={setItem}
            onChangeBattery={setBattery}
            onChangeFunda={setFunda}
          />
        )}

        {/* Hidden: warranty_void se auto-marca desde useEffect del padre. */}
        <input type="hidden" {...register('warranty_void')} />
        <input type="hidden" {...register('warranty_void_reason')} />
      </CardContent>
    </Card>
  );
}

interface ChecklistEditorProps {
  checklist: IntakeChecklistData;
  onChangeItem: (key: IntakeChecklistItemKey, value: IntakeChecklistItemStatus) => void;
  onChangeBattery: (raw: string) => void;
  onChangeFunda: (v: boolean) => void;
}

function ChecklistEditor({
  checklist,
  onChangeItem,
  onChangeBattery,
  onChangeFunda,
}: ChecklistEditorProps) {
  const counts = INTAKE_CHECKLIST_ITEMS.reduce(
    (acc, item) => {
      const status = checklist[item.key] as IntakeChecklistItemStatus;
      acc[status] += 1;
      return acc;
    },
    { ok: 0, falla: 0, nc: 0 },
  );
  const total = INTAKE_CHECKLIST_ITEMS.length;
  const reviewed = total - counts.nc;
  const progressPct = Math.round((reviewed / total) * 100);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">
            Revisados {reviewed}/{total}
          </span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-mono">{counts.ok}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span className="font-mono">{counts.falla}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              <span className="font-mono">{counts.nc}</span>
            </span>
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>OK</strong> = funciona · <strong>Falla</strong> = no funciona o tiene daño ·{' '}
        <strong>N/C</strong> = no se pudo comprobar.
      </p>

      <GroupSection icon="⚡" title="Carga y batería">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="bateria_porcentaje" className="text-xs text-muted-foreground">
              Batería (%)
            </Label>
            <Input
              id="bateria_porcentaje"
              type="number"
              min={0}
              max={100}
              placeholder="0-100"
              value={checklist.bateria_porcentaje ?? ''}
              onChange={(e) => onChangeBattery(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <ItemRow
            label="Carga"
            value={checklist.carga}
            onChange={(v) => onChangeItem('carga', v)}
          />
          <ItemRow
            label="Estado de batería"
            value={checklist.bateria_estado}
            onChange={(v) => onChangeItem('bateria_estado', v)}
          />
        </div>
      </GroupSection>

      {INTAKE_CHECKLIST_GROUPS.filter((g) => g.title !== 'Carga y batería').map((group) => (
        <GroupSection key={group.title} icon={group.icon} title={group.title}>
          <div className="space-y-2">
            {group.items.map((key) => (
              <ItemRow
                key={key}
                label={ITEM_LABELS[key]}
                value={checklist[key] as IntakeChecklistItemStatus}
                onChange={(v) => onChangeItem(key, v)}
              />
            ))}
          </div>
        </GroupSection>
      ))}

      <GroupSection icon="🛡️" title="Accesorios">
        <div className="flex items-center gap-3 rounded-md border border-border/40 px-3 py-2">
          <Switch
            id="trae_funda"
            checked={checklist.trae_funda}
            onCheckedChange={onChangeFunda}
          />
          <Label htmlFor="trae_funda" className="cursor-pointer text-sm">
            Trae funda
          </Label>
        </div>
      </GroupSection>
    </div>
  );
}

function GroupSection({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span aria-hidden className="text-base">
          {icon}
        </span>
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function ItemRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: IntakeChecklistItemStatus;
  onChange: (v: IntakeChecklistItemStatus) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/40 px-3 py-2">
      <span className="flex-1 text-sm">{label}</span>
      <SegmentedStatus value={value} onChange={onChange} />
    </div>
  );
}

const STATUS_OPTIONS: {
  v: IntakeChecklistItemStatus;
  label: string;
  activeClass: string;
}[] = [
  { v: 'ok', label: 'OK', activeClass: 'bg-emerald-500 text-white shadow-sm' },
  { v: 'falla', label: 'Falla', activeClass: 'bg-destructive text-destructive-foreground shadow-sm' },
  { v: 'nc', label: 'N/C', activeClass: 'bg-muted text-foreground shadow-sm' },
];

function SegmentedStatus({
  value,
  onChange,
}: {
  value: IntakeChecklistItemStatus;
  onChange: (v: IntakeChecklistItemStatus) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-md border border-input bg-secondary/60 p-0.5 text-xs">
      {STATUS_OPTIONS.map((opt) => {
        const active = value === opt.v;
        return (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={cn(
              'min-w-[3.25rem] rounded px-2.5 py-1 font-medium transition-all duration-150',
              active
                ? opt.activeClass
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
            )}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function disclaimerFor(reason: IntakeChecklistReason): string {
  switch (reason) {
    case 'apagado':
      return 'Equipo apagado o no enciende. No hay forma de revisar funcionalidad — el checklist no aplica.';
    case 'mojado':
      return 'Equipo con humedad o exposición a líquidos. No se puede revisar funcionalidad y el equipo NO RECIBE GARANTÍA del servicio.';
    case 'sin_codigo':
      return 'El cliente no proporcionó código de desbloqueo. Funcionalidad limitada al diagnóstico — el equipo NO RECIBE GARANTÍA.';
    case 'otro':
      return 'Estado especial del equipo: la revisión es limitada.';
  }
}
