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
// Scriptable: New script → paste this → name it Strata → add a Scriptable
// widget to your home screen OR lock screen and pick this script. Every size
// is supported, including the three lock-screen slots.
const ENDPOINT = "${endpoint}";

const BG_TOP = new Color("#17181b");
const BG_BOT = new Color("#0a0a0b");
const INK = new Color("#f3f0ea");
const SUBTLE = new Color("#8a8880");
const FAINT = new Color("#b4b2ac");
const UP = new Color("#4ec48a");
const DOWN = new Color("#ef6b78");

let data = null;
try {
  const req = new Request(ENDPOINT);
  req.timeoutInterval = 12;
  data = await req.loadJSON();
} catch (e) {
  data = null;
}

const family = config.widgetFamily || "medium";
const w = new ListWidget();
w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

const eur0 = (n) => "€" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: 0 });
const pct1 = (n) => (n >= 0 ? "+" : "") + Number(n).toFixed(1) + "%";
const arrow = (n) => (n >= 0 ? "▲" : "▼");
const tone = (n) => (n >= 0 ? UP : DOWN);
const lock =
  family === "accessoryInline" ||
  family === "accessoryCircular" ||
  family === "accessoryRectangular";

function sparkImage(values, width, height) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  if (!values || values.length < 2) return ctx.getImage();
  const min = Math.min.apply(null, values);
  const max = Math.max.apply(null, values);
  const span = max - min || 1;
  const n = values.length;
  const dx = width / (n - 1);
  const yOf = (v) => height - 2 - ((v - min) / span) * (height - 4);
  const pts = values.map((v, i) => new Point(i * dx, yOf(v)));
  const rising = values[n - 1] >= values[0];
  const stroke = lock ? new Color("#ffffff") : rising ? UP : DOWN;

  const area = new Path();
  area.move(new Point(0, height));
  area.addLine(new Point(0, pts[0].y));
  for (let i = 1; i < n; i++) area.addLine(pts[i]);
  area.addLine(new Point(width, height));
  area.closeSubpath();
  ctx.setFillColor(new Color(lock ? "#ffffff" : rising ? "#4ec48a" : "#ef6b78", lock ? 0.18 : 0.13));
  ctx.addPath(area);
  ctx.fillPath();

  const line = new Path();
  line.move(pts[0]);
  for (let i = 1; i < n; i++) line.addLine(pts[i]);
  ctx.setStrokeColor(stroke);
  ctx.setLineWidth(2);
  ctx.addPath(line);
  ctx.strokePath();
  return ctx.getImage();
}

function symbol(stack, name, size, color) {
  const sym = SFSymbol.named(name);
  sym.applyFont(Font.boldSystemFont(size));
  const img = stack.addImage(sym.image);
  img.imageSize = new Size(size, size);
  img.tintColor = color;
  return img;
}

function renderUnavailable() {
  if (!lock) {
    const g = new LinearGradient();
    g.colors = [BG_TOP, BG_BOT];
    g.locations = [0, 1];
    w.backgroundGradient = g;
    w.setPadding(16, 16, 16, 16);
  } else {
    w.addAccessoryWidgetBackground = true;
  }
  const t = w.addText("Strata unavailable");
  t.font = Font.mediumSystemFont(lock ? 12 : 13);
  t.textColor = lock ? Color.white() : SUBTLE;
}

function header() {
  const row = w.addStack();
  row.centerAlignContent();
  const label = row.addText("STRATA");
  label.font = Font.semiboldSystemFont(9);
  label.textColor = SUBTLE;
  row.addSpacer();
  const dot = row.addText("• live");
  dot.font = Font.systemFont(9);
  dot.textColor = SUBTLE;
}

function totalBlock(bigFont) {
  const v = w.addText(eur0(data.total));
  v.font = Font.boldSystemFont(bigFont);
  v.textColor = INK;
  v.minimumScaleFactor = 0.7;
  w.addSpacer(2);
  const chip = w.addStack();
  chip.centerAlignContent();
  const day = chip.addText(arrow(data.dayChangePct) + " " + pct1(data.dayChangePct));
  day.font = Font.semiboldSystemFont(13);
  day.textColor = tone(data.dayChangePct);
  const sep = chip.addText("  today");
  sep.font = Font.systemFont(11);
  sep.textColor = SUBTLE;
}

function positionRows(count) {
  for (const p of data.positions.slice(0, count)) {
    const row = w.addStack();
    row.centerAlignContent();
    const name = row.addText(p.ticker || p.name);
    name.font = Font.mediumSystemFont(12);
    name.textColor = FAINT;
    name.lineLimit = 1;
    row.addSpacer();
    const c = row.addText(pct1(p.dayPct));
    c.font = Font.semiboldSystemFont(12);
    c.textColor = tone(p.dayPct);
    w.addSpacer(5);
  }
}

function homeBackground(pad) {
  const g = new LinearGradient();
  g.colors = [BG_TOP, BG_BOT];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  w.setPadding(pad, pad, pad, pad);
}

function renderSmall() {
  homeBackground(14);
  const top = w.addStack();
  top.centerAlignContent();
  const label = top.addText("STRATA");
  label.font = Font.semiboldSystemFont(9);
  label.textColor = SUBTLE;
  top.addSpacer();
  const d = top.addText(arrow(data.dayChangePct) + " " + pct1(data.dayChangePct));
  d.font = Font.semiboldSystemFont(10);
  d.textColor = tone(data.dayChangePct);

  w.addSpacer(4);
  const v = w.addText(eur0(data.total));
  v.font = Font.boldSystemFont(23);
  v.textColor = INK;
  v.minimumScaleFactor = 0.7;

  w.addSpacer(9);
  for (const p of data.positions.slice(0, 3)) {
    const row = w.addStack();
    row.centerAlignContent();
    const name = row.addText(p.ticker || p.name);
    name.font = Font.mediumSystemFont(13);
    name.textColor = FAINT;
    name.lineLimit = 1;
    row.addSpacer();
    const c = row.addText(pct1(p.dayPct));
    c.font = Font.semiboldSystemFont(13);
    c.textColor = tone(p.dayPct);
    w.addSpacer(6);
  }
}

function renderMedium() {
  homeBackground(16);
  header();
  w.addSpacer(8);
  const body = w.addStack();
  body.spacing = 14;

  const left = body.addStack();
  left.layoutVertically();
  left.size = new Size(140, 0);
  const v = left.addText(eur0(data.total));
  v.font = Font.boldSystemFont(28);
  v.textColor = INK;
  v.minimumScaleFactor = 0.7;
  left.addSpacer(2);
  const day = left.addText(arrow(data.dayChangePct) + " " + pct1(data.dayChangePct) + " today");
  day.font = Font.semiboldSystemFont(12);
  day.textColor = tone(data.dayChangePct);
  left.addSpacer(6);
  left.addImage(sparkImage(data.history, 150, 44)).imageSize = new Size(150, 44);

  const right = body.addStack();
  right.layoutVertically();
  right.addSpacer(2);
  for (const p of data.positions.slice(0, 4)) {
    const row = right.addStack();
    row.centerAlignContent();
    const name = row.addText(p.ticker || p.name);
    name.font = Font.mediumSystemFont(12);
    name.textColor = FAINT;
    name.lineLimit = 1;
    row.addSpacer();
    const c = row.addText(pct1(p.dayPct));
    c.font = Font.semiboldSystemFont(12);
    c.textColor = tone(p.dayPct);
    right.addSpacer(5);
  }
}

function renderLarge() {
  homeBackground(18);
  header();
  w.addSpacer(8);
  totalBlock(34);
  w.addSpacer(12);
  w.addImage(sparkImage(data.history, 300, 70)).imageSize = new Size(300, 70);
  w.addSpacer(12);
  const since = w.addText("Since cost  " + pct1(data.totalChangePct));
  since.font = Font.systemFont(11);
  since.textColor = SUBTLE;
  w.addSpacer(6);
  positionRows(8);
}

function renderInline() {
  // Inline sits beside the clock; single line, system-tinted.
  w.addText(eur0(data.total) + "  " + arrow(data.dayChangePct) + " " + pct1(data.dayChangePct));
}

function renderCircular() {
  // The system draws the round, tinted lock-screen background; we only place
  // content and let it clip to the circle. No manual padding or fill.
  w.addAccessoryWidgetBackground = true;
  const col = w.addStack();
  col.layoutVertically();
  col.centerAlignContent();
  const top = col.addStack();
  top.addSpacer();
  symbol(top, data.dayChangePct >= 0 ? "arrow.up.right" : "arrow.down.right", 11, Color.white());
  top.addSpacer();
  const mid = col.addStack();
  mid.addSpacer();
  const p = mid.addText(pct1(data.dayChangePct));
  p.font = Font.boldSystemFont(14);
  p.minimumScaleFactor = 0.6;
  mid.addSpacer();
  const lab = col.addStack();
  lab.addSpacer();
  const l = lab.addText("today");
  l.font = Font.systemFont(8);
  l.textColor = Color.gray();
  lab.addSpacer();
}

function renderRectangular() {
  // The widest lock-screen slot. iOS fixes its size, so use the full width:
  // total + today's move on the left, the top two movers on the right. The
  // system draws the rounded, tinted background.
  w.addAccessoryWidgetBackground = true;
  const row = w.addStack();
  row.centerAlignContent();

  const left = row.addStack();
  left.layoutVertically();
  const total = left.addText(eur0(data.total));
  total.font = Font.boldSystemFont(18);
  total.minimumScaleFactor = 0.6;
  left.addSpacer(2);
  const dayRow = left.addStack();
  dayRow.centerAlignContent();
  symbol(dayRow, data.dayChangePct >= 0 ? "arrow.up.right" : "arrow.down.right", 10, Color.white());
  dayRow.addSpacer(2);
  const day = dayRow.addText(pct1(data.dayChangePct) + " today");
  day.font = Font.semiboldSystemFont(12);

  row.addSpacer();

  const right = row.addStack();
  right.layoutVertically();
  right.size = new Size(84, 0);
  const movers = data.positions.slice(0, 2);
  if (movers.length === 0) {
    const none = right.addText("Since cost " + pct1(data.totalChangePct));
    none.font = Font.systemFont(11);
    none.textColor = Color.gray();
  } else {
    for (let i = 0; i < movers.length; i++) {
      const p = movers[i];
      const prow = right.addStack();
      prow.centerAlignContent();
      const t = prow.addText(p.ticker || p.name);
      t.font = Font.mediumSystemFont(11);
      t.textColor = Color.gray();
      t.lineLimit = 1;
      prow.addSpacer();
      const c = prow.addText(pct1(p.dayPct));
      c.font = Font.semiboldSystemFont(11);
      if (i === 0) right.addSpacer(3);
    }
  }
}

if (!data) {
  renderUnavailable();
} else if (family === "accessoryInline") {
  renderInline();
} else if (family === "accessoryCircular") {
  renderCircular();
} else if (family === "accessoryRectangular") {
  renderRectangular();
} else if (family === "small") {
  renderSmall();
} else if (family === "large") {
  renderLarge();
} else {
  renderMedium();
}

Script.setWidget(w);
if (family === "small") w.presentSmall();
else if (family === "large") w.presentLarge();
else if (family === "medium") w.presentMedium();
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
                Add a Scriptable widget → choose the Strata script. On the lock
                screen, pick the wide <b>rectangular</b> slot below the clock for
                the most detail (iOS fixes the size of lock-screen widgets).
              </li>
              <li>
                Updating the script later? Remove the widget and add it again so
                iOS reloads the new layout — editing the script alone won't
                always refresh it.
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
