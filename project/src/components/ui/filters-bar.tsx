import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, Search } from 'lucide-react';

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select';
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface FiltersBarProps {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  children?: ReactNode;
}

export function FiltersBar({ fields, values, onChange, onReset, children }: FiltersBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
          {field.type === 'text' ? (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-48 pl-8"
                placeholder={field.placeholder}
                value={values[field.key] ?? ''}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            </div>
          ) : (
            <Select
              value={values[field.key] ?? 'all'}
              onValueChange={(v) => onChange(field.key, v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder={field.placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
        <RotateCcw className="mr-1.5 h-4 w-4" />
        Limpar
      </Button>
      {children}
    </div>
  );
}