import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { CardTitle } from '@/ui/Heading';
import {
  useCreateWidgetToken,
  useWidgetToken,
  widgetEndpoint,
} from './api/useWidget';

const scriptableSource = (endpoint: string, appUrl: string): string => `// Strata — iPhone widget
// Scriptable: New script → paste this → name it Strata → add a Scriptable
// widget to your home screen OR lock screen and pick this script. Every size
// is supported, including the three lock-screen slots.
const ENDPOINT = "${endpoint}";
const APP_URL = "${appUrl}";

// iOS opens https links in Safari, not an installed PWA, and only some iOS
// versions let a Shortcut open a home-screen web app. Default: open the app in
// Safari (reliable everywhere). If your iOS DOES list the Strata web app under
// Shortcuts → "Open App", make a Shortcut with that single action named exactly
// SHORTCUT_NAME and switch OPEN_WITH to "shortcut" to open the installed PWA.
const OPEN_WITH = "browser"; // "browser" | "shortcut"
const SHORTCUT_NAME = "Strata";

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
// Tapping the widget opens Strata instead of the Scriptable editor — via a
// Shortcut so the installed PWA opens rather than Safari (see OPEN_WITH above).
if (OPEN_WITH === "shortcut") {
  w.url = "shortcuts://run-shortcut?name=" + encodeURIComponent(SHORTCUT_NAME);
} else if (APP_URL) {
  w.url = APP_URL;
}
// Hint iOS to refresh roughly every 15 min. iOS ultimately decides the cadence
// and no app can force it — but the endpoint reads live prices, so each refresh
// already reflects your latest in-app "refresh prices" without opening this.
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

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

function roundedCard(color) {
  // iOS's own accessory background renders with near-square corners on some
  // versions, so we draw our own rounded card. The card is inset inside a
  // larger canvas whose transparent margin absorbs any aspect-fill cropping,
  // so the rounded corners always survive.
  const W = 360;
  const H = 158;
  const inset = 10;
  const radius = 30;
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const path = new Path();
  path.addRoundedRect(new Rect(inset, inset, W - inset * 2, H - inset * 2), radius, radius);
  ctx.addPath(path);
  ctx.setFillColor(color);
  ctx.fillPath();
  return ctx.getImage();
}

function renderRectangular() {
  // The slot is narrow, so a single left-aligned column: the total gets the
  // whole width on line 1 (with the day move beside it), then the top movers on
  // line 2. Two columns squeezed the total into an ellipsis, so avoid them.
  w.backgroundImage = roundedCard(new Color("#ffffff", 0.18));
  w.setPadding(6, 12, 6, 12);

  const line1 = w.addStack();
  line1.centerAlignContent();
  const total = line1.addText(eur0(data.total));
  total.font = Font.boldSystemFont(18);
  total.lineLimit = 1;
  total.minimumScaleFactor = 0.6;
  line1.addSpacer(8);
  symbol(line1, data.dayChangePct >= 0 ? "arrow.up.right" : "arrow.down.right", 10, Color.white());
  line1.addSpacer(2);
  const day = line1.addText(pct1(data.dayChangePct));
  day.font = Font.semiboldSystemFont(13);
  day.lineLimit = 1;

  w.addSpacer(4);
  const movers = data.positions.slice(0, 2);
  const second =
    movers.length > 0
      ? movers.map((p) => (p.ticker || p.name) + " " + pct1(p.dayPct)).join("   ")
      : "Since cost " + pct1(data.totalChangePct);
  const l2 = w.addText(second);
  l2.font = Font.systemFont(11);
  l2.textColor = Color.gray();
  l2.lineLimit = 1;
  l2.minimumScaleFactor = 0.7;
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
        <CardTitle>iPhone widget</CardTitle>
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
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
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
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Tapping the widget opens Strata in Safari — iOS can't open an
              installed PWA from a link. If your iOS lists the Strata web app
              under Shortcuts → “Open App”, you can make a Shortcut with that
              action named <b>Strata</b> and set{' '}
              <code>OPEN_WITH = "shortcut"</code> at the top of the script to open
              the installed app instead.
            </p>
          </Surface>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() =>
                copy('script', scriptableSource(endpoint, window.location.origin))
              }
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

          {/* Automatic Widget Updates with iOS Shortcuts */}
          <Surface elevation="flat" className="flex flex-col gap-2 rounded-[var(--radius-field)] p-4 border border-[var(--line)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-strong)]">
                ⚡ Atualização Automática do Widget (Atalhos iOS)
              </span>
              <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                Recomendado
              </span>
            </div>
            <p className="text-xs text-[var(--text-2)]">
              Por predefinição, o iOS atualiza os widgets a cada 15–45 min. Se quiseres que o widget fique <b>sempre atualizado</b>:
            </p>
            <ol className="ml-4 list-decimal text-xs text-[var(--text-muted)] space-y-1">
              <li>Abre a app <b>Atalhos (Shortcuts)</b> no iPhone → separador <b>Automação</b>.</li>
              <li>Toca em <b>+</b> (Nova Automação) e escolhe <b>App</b>.</li>
              <li>Escolhe <b>Strata</b> (ou Trading 212 / Safari) e seleciona <b>Ao ser fechada</b>.</li>
              <li>Marca <b>Executar Imediatamente</b> (Run Immediately).</li>
              <li>Na ação, pesquisa por <b>Scriptable</b> → escolhe <b>Recarregar Todos os Widgets</b> (Reload All Widgets).</li>
            </ol>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Dica: Também podes criar outra automação por <b>Hora do dia</b> (ex: 09:00, 13:00, 18:00, 22:00) para manter os números sempre frescos mesmo sem abrires a app.
            </p>
          </Surface>

          {/* Apple Wallet / Apple Pay Purchases Automation */}
          <Surface elevation="sunken" className="flex flex-col gap-3 rounded-[var(--radius-field)] p-4 border border-[var(--accent)]/30">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                  💳 Apple Wallet & Compras (Apple Pay)
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Regista compras automaticamente no Strata sempre que pagares com o Apple Pay.
                </p>
              </div>
            </div>

            <ol className="ml-4 list-decimal text-xs text-[var(--text-2)] space-y-1.5">
              <li>
                Na app <b>Atalhos</b> do iPhone → <b>Automação</b> → toca em <b>+</b>.
              </li>
              <li>
                Escolhe o gatilho <b>Transação</b> (Apple Pay) e seleciona o teu cartão (ou qualquer cartão).
              </li>
              <li>
                Seleciona <b>Executar Imediatamente</b> (Run Immediately) sem perguntar.
              </li>
              <li>
                Adiciona a ação <b>Obter Conteúdo do URL</b> (Get Contents of URL):
                <ul className="ml-4 list-disc mt-1 text-[var(--text-muted)] space-y-0.5">
                  <li><b>URL</b>: colar o teu Webhook URL (copia abaixo)</li>
                  <li><b>Método</b>: <code>POST</code></li>
                  <li><b>Cabeçalhos</b>: <code>Content-Type: application/json</code></li>
                  <li>
                    <b>Corpo do Pedido (JSON)</b>:
                    <br />
                    <code>amount</code> = Variável da Transação <i>(Quantia)</i>
                    <br />
                    <code>merchant</code> = Variável da Transação <i>(Comerciante)</i>
                  </li>
                </ul>
              </li>
              <li>
                Pronto! Cada compra feita no terminal com o iPhone ou Apple Watch entra automaticamente como despesa na tua conta à ordem!
              </li>
            </ol>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy('webhook', endpoint)}
              >
                {copied === 'webhook' ? 'Copied ✓' : 'Copiar Webhook URL'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  copy(
                    'payload',
                    JSON.stringify(
                      {
                        amount: 12.5,
                        merchant: 'Continente',
                      },
                      null,
                      2,
                    ),
                  )
                }
              >
                {copied === 'payload' ? 'Copied ✓' : 'Copiar JSON de Exemplo'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  copy(
                    'quickadd',
                    `${window.location.origin}/?add=true&amount=12.50&merchant=Loja`,
                  )
                }
              >
                {copied === 'quickadd' ? 'Copied ✓' : 'Copiar URL do Quick-Add'}
              </Button>
            </div>
          </Surface>

          <p className="text-xs text-[var(--text-muted)]">
            Mantém o link privado — quem o tiver pode ver os teus holdings ou registar despesas.
            Clica em Regenerate caso precises de revogar o token.
          </p>
        </div>
      )}
    </Card>
  );
};
