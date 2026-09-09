import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, breadcrumbs, action, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
          {breadcrumbs.map((bc, i) => (
            <span key={i} className="flex items-center gap-1">
              {bc.href ? (
                <Link to={bc.href} className="hover:text-foreground">{bc.label}</Link>
              ) : (
                <span className="text-foreground">{bc.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
