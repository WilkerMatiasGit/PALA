import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StockAlertBadgeProps {
  quantidade: number;
  minima: number;
  className?: string;
}

export function StockAlertBadge({ quantidade, minima, className }: StockAlertBadgeProps) {
  if (quantidade > minima) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center', className)}>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Stock baixo: {quantidade} ≤ mín. {minima}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
