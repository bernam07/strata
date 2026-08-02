import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import {
  useCreateWidgetToken,
  useWidgetToken,
  widgetEndpoint,
} from './api/useWidget';

const scriptableSource = (endpoint: string): string => `// Strata — iPhone widget
// Scriptable: create a new script, paste this, then add a Scriptable
// widget to your home screen and pick this script.
const ENDPOINT = "${endpoint}";

const data = await new Request(ENDPOINT).loadJSON();
const w = new ListWidget();
w.backgroundColor = new Color("#0a0a0b");
w.setPadding(14, 14, 14, 14);

const bronze = new Color("#e0a44a");
const up = new Color("#52c48c");
const down = new Color("#ef6b78");
const muted = new Color("#79776f");

const title = w.addText("STRATA");
title.font = Font.mediumSystemFont(9);
title.textColor = muted;

const total = w.addText("€" + Number(data.total).toLocaleString());
total.font = Font.boldSystemFont(24);
total.textColor = new Color("#f3f0ea");

const chg = w.addText(
  (data.totalChangePct >= 0 ? "▲ " : "▼ ") + Math.abs(data.totalChangePct) + "%"
);
chg.font = Font.semiboldSystemFont(12);
chg.textColor = data.totalChangePct >= 0 ? up : down;

w.addSpacer(8);

for (const p of data.positions.slice(0, 4)) {
  const row = w.addStack();
  row.centerAlignContent();
  const name = row.addText(p.ticker || p.name);
  name.font = Font.mediumSystemFont(12);
  name.textColor = new Color("#b4b2ac");
  row.addSpacer();
  const pct = row.addText((p.changePct >= 0 ? "+" : "") + p.changePct + "%");
  pct.font = Font.semiboldSystemFont(12);
  pct.textColor = p.changePct >= 0 ? up : down;
  w.addSpacer(3);
}

const foot = w.addText("Updated " + new Date(data.updatedAt).toLocaleTimeString());
foot.font = Font.systemFont(8);
foot.textColor = muted;

Script.setWidget(w);
w.presentMedium();
Script.complete();
`;

export const WidgetCard = () => {
  const { data: token } = useWidgetToken();
  const create = useCreateWidgetToken();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const endpoint = token ? widgetEndpoint(token) : '';

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold text-[var(--text-strong)]">iPhone widget</h2>
        <p className="text-xs text-[var(--text-muted)]">
          A read-only link with just your investments — no cash balances, no
          transactions. Use it with the Scriptable app.
        </p>
      </div>

      {!token ? (
        <div>
          <Button
            disabled={create.isPending}
            onClick={() => create.mutate()}
          >
            Generate widget link
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Surface elevation="sunken" className="flex flex-col gap-2 p-4">
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
              Steps
            </p>
            <ol className="ml-4 list-decimal text-sm text-[var(--text-2)]">
              <li>Install the free Scriptable app from the App Store.</li>
              <li>New script → paste the script below → name it Strata.</li>
              <li>
                Home screen → add a Scriptable widget → choose the Strata script.
              </li>
            </ol>
          </Surface>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => copy('script', scriptableSource(endpoint))}
            >
              {copied === 'script' ? 'Copied ✓' : 'Copy Scriptable script'}
            </Button>
            <Button variant="ghost" onClick={() => copy('link', endpoint)}>
              {copied === 'link' ? 'Copied ✓' : 'Copy raw link'}
            </Button>
            <Button
              variant="ghost"
              disabled={create.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Regenerate the token? The old widget link stops working.',
                  )
                ) {
                  create.mutate();
                }
              }}
            >
              Regenerate
            </Button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Keep the link private — anyone with it can see your holdings.
            Regenerate to revoke it.
          </p>
        </div>
      )}
    </Card>
  );
};
