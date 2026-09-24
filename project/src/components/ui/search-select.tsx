import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface SearchSelectOption {
  value: string;
  label: string;
}

interface Props {
  value?: string;
  onValueChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  canCreate?: boolean;
  onCreate?: (name: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function SearchSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Pesquisar...',
  emptyMessage = 'Sem resultados.',
  canCreate = false,
  onCreate,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);
  const queryTrim = query.trim();
  const exists = queryTrim ? options.some((o) => o.value.toLowerCase() === queryTrim.toLowerCase()) : true;

  const handleSelect = (option: SearchSelectOption) => {
    onValueChange(option.value);
    setOpen(false);
    setQuery('');
  };

  const handleCreate = async () => {
    if (!queryTrim || !onCreate || exists) return;
    try {
      await onCreate(queryTrim);
      onValueChange(queryTrim);
      setOpen(false);
      setQuery('');
    } catch {
      // erro propagado pelo caller (toast)
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          {selected ? selected.label : value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command value={value}>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {canCreate && queryTrim && !exists && onCreate && (
          <div className="border-t p-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCreate} className="w-full gap-1">
              <Plus className="h-4 w-4" />
              Criar &quot;{queryTrim}&quot;
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}