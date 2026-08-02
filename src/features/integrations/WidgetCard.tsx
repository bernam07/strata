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
// Scriptable: create a new script, paste this, add a Scriptable widget to your
// home screen (any size) and pick this script.
const ENDPOINT = "${endpoint}";

const INK = new Color("#f3f0ea");
const MUTED = new Color("#79776f");
const UP = new Color("#52c48c");
const DOWN = new Color("#ef6b78");

const data = await new Request(ENDPOINT).loadJSON();
const family = config.widgetFamily || "medium";

const w = new ListWidget();
w.backgroundColor = new Color("#0a0a0b");

const eur = (n) =>
  "€" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: 0 });
const pct = (n) => (n >= 0 ? "+" : "") + n + "%";
const changeColor = (n) => (n >= 0 ? UP : DOWN);

const addTotal = (big) => {
  const t = w.addText("STRATA");
  t.font = Font.mediumSystemFont(9);
  t.textColor = MUTED;
  const v = w.addText(eur(data.total));
  v.font = Font.boldSystemFont(big ? 28 : 22);
  v.textColor = INK;
  const c = w.addText(
    (data.totalChangePct >= 0 ? "▲ " : "▼ ") + pct(data.totalChangePct)
  );
  c.font = Font.semiboldSystemFont(13);
  c.textColor = changeColor(data.totalChangePct);
};

const addRows = (count) => {
  for (const p of data.positions.slice(0, count)) {
    const row = w.addStack();
    row.centerAlignContent();
    const name = row.addText(p.ticker || p.name);
    name.font = Font.mediumSystemFont(12);
    name.textColor = new Color("#b4b2ac");
    name.lineLimit = 1;
    row.addSpacer();
    const c = row.addText(pct(p.changePct));
    c.font = Font.semiboldSystemFont(12);
    c.textColor = changeColor(p.changePct);
    w.addSpacer(4);
  }
};

if (family === "small") {
  w.setPadding(14, 14, 14, 14);
  addTotal(true);
  w.addSpacer(6);
  addRows(2);
} else if (family === "large") {
  w.setPadding(18, 18, 18, 18);
  addTotal(true);
  w.addSpacer(10);
  addRows(8);
} else {
  w.setPadding(16, 16, 16, 16);
  addTotal(false);
  w.addSpacer(8);
  addRows(4);
}

Script.setWidget(w);
if (family === "small") w.presentSmall();
else if (family === "large") w.presentLarge();
else w.presentMedium();
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
