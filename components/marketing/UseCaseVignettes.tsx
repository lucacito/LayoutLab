import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

export function UseCaseVignettes({
  items,
  className = '',
}: {
  items: { icon: string; title: string; body: string }[];
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-6 sm:grid-cols-3 ${className}`}>
      {items.map((v) => (
        <Card key={v.title} className="p-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-button bg-fog text-action">
            <Icon name={v.icon} size={22} />
          </div>
          <h3 className="mt-4 text-body font-semibold text-navy">{v.title}</h3>
          <p className="mt-2 text-body text-muted">{v.body}</p>
        </Card>
      ))}
    </div>
  );
}
