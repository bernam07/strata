import { useMemo } from 'react';
import { buildInsights, type Insight } from '@/core/analytics/insights';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import {
  useAssignments,
  useCategories,
} from '@/features/expenses/api/useCategories';
import { Card } from '@/ui/Card';
import { eur0 } from '@/ui/format';

const dotColor: Record<Insight['tone'], string> = {
  positive: 'var(--positive)',
  negative: 'var(--negative)',
  neutral: 'var(--accent)',
};

export const InsightsStrip = ({
  cash,
  investments,
}: {
  cash: number;
  investments: number;
}) => {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: assignments } = useAssignments();

  const insights = useMemo(() => {
    const nameById = new Map(categories.map((c) => [c.id, c.name]));
    const categoryOf = (transactionId: string) => {
      const id = assignments?.get(transactionId);
      return (id && nameById.get(id)) || 'Uncategorized';
    };
    return buildInsights({
      now: new Date(),
      transactions,
      cash,
      investments,
      fmt: (value) => eur0.format(value),
      categoryOf,
    }).slice(0, 3);
  }, [transactions, categories, assignments, cash, investments]);

  if (insights.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        Insights
      </h2>
      <ul className="flex flex-col gap-2.5">
        {insights.map((insight) => (
          <li key={insight.id} className="flex items-start gap-2.5">
            <span
              className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
              style={{ background: dotColor[insight.tone] }}
            />
            <span className="text-sm text-[var(--text-2)]">{insight.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};
