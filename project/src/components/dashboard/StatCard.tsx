import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color?: 'primary' | 'amber' | 'emerald' | 'blue' | 'red';
}

const COLORS: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  amber: 'bg-amber-100 text-amber-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  blue: 'bg-blue-100 text-blue-600',
  red: 'bg-red-100 text-red-600',
};

export function StatCard({ icon: Icon, label, value, color = 'primary' }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', COLORS[color])}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
