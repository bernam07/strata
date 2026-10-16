import type { TransactionKind } from '../types';

export interface XtbInstrumentInfo {
  xtbTicker: string;
  bareTicker: string;
  yahooSymbol: string;
  name: string;
  category: string;
}

export interface XtbOpenPosition {
  xtbTicker: string;
  bareTicker: string;
  yahooSymbol: string;
  name: string;
  category: string;
  quantity: number;
  marketValueEur: number;
  netProfitEur: number;
  costBasisEur: number;
  averagePriceEur: number;
  currentPriceEur: number;
  openPriceNative: number | null;
  currentPriceNative: number | null;
}

export interface XtbCashOperation {
  id: string;
  externalId: string;
  rawType: string;
  kind: TransactionKind;
  instrument: string | null;
  xtbTicker: string | null;
  category: string | null;
  occurredAt: string;
  amount: number;
  quantity: number | null;
  comment: string | null;
  note: string;
  positionId: string | null;
}

export interface XtbClosedPosition {
  positionId: string;
  instrument: string;
  xtbTicker: string;
  category: string;
  type: string;
  volume: number;
  openPrice: number;
  openTime: string;
  closePrice: number;
  closeTime: string;
  profitLoss: number;
  purchaseValue: number;
  saleValue: number;
  comment: string | null;
}

export interface XtbParsedReport {
  accountNumber: string | null;
  generatedAt: string | null;
  currency: string;
  openPositionValue: number;
  openPositionProfit: number;
  investedCost: number;
  cashOperationsTotal: number;
  openPositions: XtbOpenPosition[];
  cashOperations: XtbCashOperation[];
  closedPositions: XtbClosedPosition[];
  instruments: Map<string, XtbInstrumentInfo>;
}

const XTB_TO_YAHOO_SUFFIX: Record<string, string> = {
  US: '',
  PT: '.LS',
  DE: '.DE',
  UK: '.L',
  FR: '.PA',
  NL: '.AS',
  ES: '.MC',
  IT: '.MI',
  PL: '.WA',
  CH: '.SW',
  BE: '.BR',
  DK: '.CO',
  SE: '.ST',
  FI: '.HE',
  NO: '.OL',
  CZ: '.PR',
  HU: '.BD',
};

export const xtbTickerToYahooSymbol = (rawTicker: string): {
  bareTicker: string;
  yahooSymbol: string;
} => {
  const cleaned = rawTicker.trim().replace(/_\d+$/, '');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastDot <= 0) {
    return { bareTicker: cleaned, yahooSymbol: cleaned };
  }
  const base = cleaned.slice(0, lastDot).replace(/\./g, '-');
  const market = cleaned.slice(lastDot + 1).toUpperCase();
  const suffix = XTB_TO_YAHOO_SUFFIX[market];
  if (suffix !== undefined) {
    return {
      bareTicker: base,
      yahooSymbol: `${base}${suffix}`,
    };
  }
  return {
    bareTicker: base,
    yahooSymbol: cleaned,
  };
};

export const parseCsvRows = (text: string): string[][] => {
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && clean[i + 1] === '\n') {
        i += 1;
      }
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
};

const toUtcIso = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return new Date().toISOString();
  // XTB timestamps are formatted as "YYYY-MM-DD HH:mm:ss" in UTC
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed.replace(/\s+/, 'T')}.000Z`;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
};

const toNum = (raw: string | undefined): number => {
  if (!raw) return 0;
  const normalized = raw.replace(/\s+/g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const mapCashOperationKind = (rawType: string, amount: number): TransactionKind => {
  const lower = rawType.trim().toLowerCase();
  if (
    lower.includes('stock purchase') ||
    lower.includes('etf purchase') ||
    lower === 'open trade'
  ) {
    return 'buy';
  }
  if (
    lower.includes('stock sell') ||
    lower.includes('stock sale') ||
    lower.includes('etf sell') ||
    lower.includes('etf sale') ||
    lower === 'close trade'
  ) {
    return 'sell';
  }
  if (lower.includes('deposit') || lower === 'transfer in') {
    return 'deposit';
  }
  if (lower.includes('withdraw') || lower === 'transfer out') {
    return 'withdrawal';
  }
  if (lower.includes('dividend') || lower.includes('dywidend')) {
    return 'dividend';
  }
  if (
    lower.includes('withholding tax') ||
    lower.includes('interest tax') ||
    lower.includes('tax') ||
    lower.includes('fee') ||
    lower.includes('commission') ||
    lower.includes('swap')
  ) {
    return 'fee';
  }
  if (lower.includes('interest')) {
    return 'interest';
  }
  return amount >= 0 ? 'income' : 'fee';
};

export const extractTradeQuantityFromComment = (
  comment: string | null | undefined,
  kind: TransactionKind,
): number | null => {
  if (!comment) return null;
  // Matches e.g. "OPEN BUY NKE.US 1/1.4007 @ 37.18" or "CLOSE BUY GALP.PT 1 @ 22.550"
  const match = comment.match(
    /\b(?:OPEN|CLOSE)\s+(?:BUY|SELL)\s+\S+\s+(\d+(?:\.\d+)?)(?:\/\d+(?:\.\d+)?)?\s*@/i,
  );
  if (!match || !match[1]) return null;
  const qty = Number(match[1]);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return kind === 'sell' ? -qty : qty;
};

const formatCashOperationNote = (
  rawType: string,
  instrument: string | null,
  comment: string | null,
  kind: TransactionKind,
): string => {
  if (kind === 'deposit') return 'XTB Deposit';
  if (kind === 'withdrawal') return 'XTB Withdrawal';
  if (kind === 'dividend') {
    return instrument ? `Dividend · ${instrument}` : 'XTB Dividend';
  }
  if (kind === 'buy' || kind === 'sell') {
    const priceMatch = comment?.match(/@\s*(\d+(?:\.\d+)?)/);
    const priceSuffix = priceMatch?.[1] ? ` @ ${priceMatch[1]}` : '';
    const actionLabel = kind === 'buy' ? 'Buy' : 'Sell';
    if (instrument) return `${actionLabel} ${instrument}${priceSuffix}`;
  }
  return comment || rawType || 'XTB Operation';
};

const indexHeaders = (row: string[]): Map<string, number> => {
  const map = new Map<string, number>();
  row.forEach((cell, idx) => {
    const key = cell.trim().toLowerCase();
    if (key && !map.has(key)) {
      map.set(key, idx);
    }
  });
  return map;
};

export const parseXtbReport = (csvText: string): XtbParsedReport => {
  const rows = parseCsvRows(csvText);

  let accountNumber: string | null = null;
  let generatedAt: string | null = null;
  let currency = 'EUR';
  let metricOpenValue: number | null = null;
  let metricOpenProfit: number | null = null;
  let metricCashTotal: number | null = null;

  type Section = 'none' | 'closed_positions' | 'cash_operations' | 'open_positions';
  let section: Section = 'none';
  let activeHeader: Map<string, number> | null = null;
  let openSubtable: 'none' | 'metrics' | 'positions' = 'none';

  const closedPositions: XtbClosedPosition[] = [];
  const cashOperations: XtbCashOperation[] = [];
  const instruments = new Map<string, XtbInstrumentInfo>();

  const registerInstrument = (
    xtbTicker: string,
    name: string,
    category = 'STOCK',
  ) => {
    const cleanTicker = xtbTicker.trim();
    if (!cleanTicker) return;
    const { bareTicker, yahooSymbol } = xtbTickerToYahooSymbol(cleanTicker);
    const existing = instruments.get(cleanTicker);
    const cleanName = name.trim();
    const isNumericId = /^\d+$/.test(cleanName);
    if (!existing) {
      instruments.set(cleanTicker, {
        xtbTicker: cleanTicker,
        bareTicker,
        yahooSymbol,
        name: !isNumericId && cleanName ? cleanName : bareTicker,
        category: category.trim() || 'STOCK',
      });
    } else if (!isNumericId && cleanName && existing.name === existing.bareTicker) {
      existing.name = cleanName;
    }
  };

  interface OpenAccumulator {
    xtbTicker: string;
    name: string;
    category: string;
    summaryVolume: number | null;
    summaryValue: number | null;
    summaryProfit: number | null;
    summaryOpenPrice: number | null;
    lotsVolume: number;
    lotsValue: number;
    lotsProfit: number;
    lotOpenPrice: number | null;
    lotCurrentPrice: number | null;
  }

  const openByTicker = new Map<string, OpenAccumulator>();

  for (const row of rows) {
    const first = (row[0] ?? '').trim();
    const firstLower = first.toLowerCase();

    if (!row.some((cell) => cell.trim().length > 0)) {
      continue;
    }

    if (firstLower === 'account number') {
      if (row[1]?.trim()) {
        accountNumber = row[1].trim();
      }
      continue;
    }

    if (firstLower === 'closed positions') {
      section = 'closed_positions';
      activeHeader = null;
      continue;
    }

    if (firstLower === 'cash operations') {
      section = 'cash_operations';
      activeHeader = null;
      continue;
    }

    if (firstLower === 'open positions') {
      section = 'open_positions';
      activeHeader = null;
      openSubtable = 'none';
      continue;
    }

    if (
      firstLower.startsWith('date from') ||
      firstLower.startsWith('date to') ||
      firstLower === 'note'
    ) {
      continue;
    }

    if (firstLower.startsWith('data as of report generated')) {
      if (row[1]?.trim()) {
        generatedAt = toUtcIso(row[1]);
      }
      continue;
    }

    if (section === 'closed_positions') {
      if (firstLower === 'instrument' && row.some((c) => c.toLowerCase() === 'ticker')) {
        activeHeader = indexHeaders(row);
        continue;
      }
      if (!activeHeader || firstLower === 'profit/loss' || firstLower === 'total') {
        continue;
      }
      const get = (col: string) => row[activeHeader!.get(col) ?? -1] ?? '';
      const ticker = get('ticker').trim();
      const instrument = get('instrument').trim();
      if (!ticker) continue;
      const category = get('category').trim() || 'STOCK';
      registerInstrument(ticker, instrument, category);
      closedPositions.push({
        positionId: get('position id').trim(),
        instrument: instrument || ticker,
        xtbTicker: ticker,
        category,
        type: get('type').trim() || 'BUY',
        volume: toNum(get('volume')),
        openPrice: toNum(get('open price')),
        openTime: toUtcIso(get('open time (utc)')),
        closePrice: toNum(get('close price')),
        closeTime: toUtcIso(get('close time (utc)')),
        profitLoss: toNum(get('profit/loss')),
        purchaseValue: toNum(get('purchase value')),
        saleValue: toNum(get('sale value')),
        comment: get('comment').trim() || null,
      });
      continue;
    }

    if (section === 'cash_operations') {
      if (firstLower === 'type' && row.some((c) => c.toLowerCase() === 'amount')) {
        activeHeader = indexHeaders(row);
        continue;
      }
      if (!activeHeader) continue;
      const get = (col: string) => row[activeHeader!.get(col) ?? -1] ?? '';
      if (firstLower === 'total') {
        metricCashTotal = toNum(get('amount'));
        continue;
      }
      const rawType = get('type').trim();
      const id = get('id').trim();
      if (!rawType || !id) continue;

      const ticker = get('ticker').trim() || null;
      const instrument = get('instrument').trim() || null;
      const category = get('category').trim() || null;
      if (ticker) {
        registerInstrument(ticker, instrument ?? ticker, category ?? 'STOCK');
      }

      const amount = toNum(get('amount'));
      const comment = get('comment').trim() || null;
      const kind = mapCashOperationKind(rawType, amount);
      const quantity = extractTradeQuantityFromComment(comment, kind);

      cashOperations.push({
        id,
        externalId: `xtb:${id}`,
        rawType,
        kind,
        instrument,
        xtbTicker: ticker,
        category,
        occurredAt: toUtcIso(get('time')),
        amount,
        quantity,
        comment,
        note: formatCashOperationNote(rawType, instrument, comment, kind),
        positionId: get('position id').trim() || null,
      });
      continue;
    }

    if (section === 'open_positions') {
      if (firstLower === 'product' && (row[1] ?? '').trim().toLowerCase() === 'metric') {
        openSubtable = 'metrics';
        activeHeader = indexHeaders(row);
        continue;
      }
      if (
        firstLower === 'product' &&
        row.some((c) => c.toLowerCase() === 'ticker') &&
        row.some((c) => c.toLowerCase() === 'volume')
      ) {
        openSubtable = 'positions';
        activeHeader = indexHeaders(row);
        continue;
      }
      if (!activeHeader) continue;

      const get = (col: string) => row[activeHeader!.get(col) ?? -1] ?? '';

      if (openSubtable === 'metrics') {
        const metric = get('metric').trim().toLowerCase();
        const amount = toNum(get('amount'));
        const curr = get('currency').trim().toUpperCase();
        if (curr.length === 3) currency = curr;
        if (metric === 'open position value') {
          metricOpenValue = amount;
        } else if (metric === 'open position profit') {
          metricOpenProfit = amount;
        }
        continue;
      }

      if (openSubtable === 'positions') {
        const ticker = get('ticker').trim();
        if (!ticker) continue;
        const instOrPos = get('instrument/position').trim();
        const category = get('category').trim();
        const rowType = get('type').trim();
        const volume = toNum(get('volume'));
        const value = toNum(get('value'));
        const netProfit = toNum(get('net profit'));
        const openPriceRaw = get('open price').trim();
        const currentPriceRaw = get('current price').trim();
        const openPrice = openPriceRaw ? toNum(openPriceRaw) : null;
        const currentPrice = currentPriceRaw ? toNum(currentPriceRaw) : null;

        let acc = openByTicker.get(ticker);
        if (!acc) {
          acc = {
            xtbTicker: ticker,
            name: instOrPos && !/^\d+$/.test(instOrPos) ? instOrPos : ticker,
            category: category || 'STOCK',
            summaryVolume: null,
            summaryValue: null,
            summaryProfit: null,
            summaryOpenPrice: null,
            lotsVolume: 0,
            lotsValue: 0,
            lotsProfit: 0,
            lotOpenPrice: null,
            lotCurrentPrice: null,
          };
          openByTicker.set(ticker, acc);
        }

        const isSummaryRow = category.length > 0 && rowType.length === 0;
        if (isSummaryRow) {
          if (instOrPos && !/^\d+$/.test(instOrPos)) {
            acc.name = instOrPos;
          }
          acc.category = category;
          acc.summaryVolume = volume;
          acc.summaryValue = value;
          acc.summaryProfit = netProfit;
          acc.summaryOpenPrice = openPrice;
          registerInstrument(ticker, acc.name, category);
        } else {
          acc.lotsVolume += volume;
          acc.lotsValue += value;
          acc.lotsProfit += netProfit;
          if (openPrice !== null && openPrice > 0) acc.lotOpenPrice = openPrice;
          if (currentPrice !== null && currentPrice > 0) {
            acc.lotCurrentPrice = currentPrice;
          }
          registerInstrument(ticker, acc.name, acc.category);
        }
      }
    }
  }

  const openPositions: XtbOpenPosition[] = [];
  for (const acc of openByTicker.values()) {
    const quantity = acc.summaryVolume ?? acc.lotsVolume;
    if (quantity <= 0) continue;
    const marketValueEur = acc.summaryValue ?? acc.lotsValue;
    const netProfitEur = acc.summaryProfit ?? acc.lotsProfit;
    const costBasisEur = Math.max(0, marketValueEur - netProfitEur);
    const averagePriceEur = quantity > 0 ? costBasisEur / quantity : 0;
    const currentPriceEur = quantity > 0 ? marketValueEur / quantity : 0;
    const { bareTicker, yahooSymbol } = xtbTickerToYahooSymbol(acc.xtbTicker);
    const info = instruments.get(acc.xtbTicker);

    openPositions.push({
      xtbTicker: acc.xtbTicker,
      bareTicker,
      yahooSymbol,
      name: info?.name ?? acc.name,
      category: acc.category,
      quantity,
      marketValueEur,
      netProfitEur,
      costBasisEur,
      averagePriceEur,
      currentPriceEur,
      openPriceNative: acc.summaryOpenPrice ?? acc.lotOpenPrice,
      currentPriceNative: acc.lotCurrentPrice,
    });
  }

  const computedOpenValue = openPositions.reduce(
    (sum, pos) => sum + pos.marketValueEur,
    0,
  );
  const computedOpenProfit = openPositions.reduce(
    (sum, pos) => sum + pos.netProfitEur,
    0,
  );
  const openPositionValue = metricOpenValue ?? computedOpenValue;
  const openPositionProfit = metricOpenProfit ?? computedOpenProfit;
  const investedCost = Math.max(0, openPositionValue - openPositionProfit);

  const computedCashTotal = cashOperations.reduce(
    (sum, op) => sum + op.amount,
    0,
  );
  const cashOperationsTotal =
    Math.round((metricCashTotal ?? computedCashTotal) * 10000) / 10000;

  return {
    accountNumber,
    generatedAt,
    currency,
    openPositionValue,
    openPositionProfit,
    investedCost,
    cashOperationsTotal,
    openPositions,
    cashOperations,
    closedPositions,
    instruments,
  };
};

const decodeXmlEntities = (str: string): string =>
  str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const colLettersToIndex = (letters: string): number => {
  let idx = 0;
  for (let i = 0; i < letters.length; i += 1) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return idx - 1;
};

const excelSerialToUtcString = (serial: number): string => {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
};

const escapeCsvField = (val: string): string => {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
};

const inflateRawBytes = async (compressed: Uint8Array): Promise<string> => {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const copy = new Uint8Array(compressed.byteLength);
  copy.set(compressed);
  void writer.write(copy);
  void writer.close();
  return new Response(ds.readable).text();
};

export const xlsxToCsvText = async (
  input: ArrayBuffer | Uint8Array,
): Promise<string> => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.byteLength < 22 || view.getUint32(0, true) !== 0x04034b50) {
    return new TextDecoder('utf-8').decode(bytes);
  }

  let eocdOffset = bytes.byteLength - 22;
  while (eocdOffset >= 0 && view.getUint32(eocdOffset, true) !== 0x06054b50) {
    eocdOffset -= 1;
  }
  if (eocdOffset < 0) {
    throw new Error('Invalid XLSX archive: missing central directory.');
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');
  const xmlFiles = new Map<string, string>();

  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(cdOffset, true) !== 0x02014b50) break;
    const method = view.getUint16(cdOffset + 10, true);
    const compSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);

    const name = decoder.decode(
      bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen),
    );
    cdOffset += 46 + nameLen + extraLen + commentLen;

    if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue;

    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compData = bytes.subarray(dataStart, dataStart + compSize);

    const text =
      method === 8
        ? await inflateRawBytes(compData)
        : decoder.decode(compData);
    xmlFiles.set(name, text);
  }

  // 1. Parse sharedStrings.xml
  const sharedStrings: string[] = [];
  const sstXml = xmlFiles.get('xl/sharedStrings.xml') ?? '';
  for (const siMatch of sstXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const inner = siMatch[1] ?? '';
    const parts: string[] = [];
    for (const tMatch of inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
      parts.push(decodeXmlEntities(tMatch[1] ?? ''));
    }
    sharedStrings.push(parts.join(''));
  }

  // 2. Parse styles.xml to identify date/time cell styles
  const dateStyleIndices = new Set<number>();
  const stylesXml = xmlFiles.get('xl/styles.xml') ?? '';
  if (stylesXml) {
    const customDateFmtIds = new Set<number>();
    for (const fmtMatch of stylesXml.matchAll(
      /<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g,
    )) {
      const id = Number(fmtMatch[1]);
      const code = (fmtMatch[2] ?? '').toLowerCase();
      if (code.includes('yy') || code.includes('dd') || code.includes('hh')) {
        customDateFmtIds.add(id);
      }
    }
    const cellXfsMatch = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
    if (cellXfsMatch) {
      let idx = 0;
      for (const xfMatch of (cellXfsMatch[1] ?? '').matchAll(/<xf\b([^>]*?)(?:\/>|>[\s\S]*?<\/xf>)/g)) {
        const attrs = xfMatch[1] ?? '';
        const numFmtMatch = attrs.match(/numFmtId="(\d+)"/);
        if (numFmtMatch) {
          const fmtId = Number(numFmtMatch[1]);
          if (
            (fmtId >= 14 && fmtId <= 22) ||
            (fmtId >= 45 && fmtId <= 47) ||
            customDateFmtIds.has(fmtId)
          ) {
            dateStyleIndices.add(idx);
          }
        }
        idx += 1;
      }
    }
  }

  // 3. Resolve worksheet names and paths
  const relsXml = xmlFiles.get('xl/_rels/workbook.xml.rels') ?? '';
  const targetByRelId = new Map<string, string>();
  for (const relMatch of relsXml.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const attrs = relMatch[1] ?? '';
    const id = attrs.match(/Id="([^"]+)"/)?.[1];
    const target = attrs.match(/Target="([^"]+)"/)?.[1];
    if (id && target) {
      const normalized = target.startsWith('xl/')
        ? target
        : `xl/${target.replace(/^\/+/, '')}`;
      targetByRelId.set(id, normalized);
    }
  }

  const workbookXml = xmlFiles.get('xl/workbook.xml') ?? '';
  const sheets: { name: string; path: string }[] = [];
  for (const sheetMatch of workbookXml.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const attrs = sheetMatch[1] ?? '';
    const name = decodeXmlEntities(attrs.match(/name="([^"]+)"/)?.[1] ?? 'Sheet');
    const rId = attrs.match(/r:id="([^"]+)"/)?.[1];
    const path = (rId && targetByRelId.get(rId)) || `xl/worksheets/sheet${sheets.length + 1}.xml`;
    if (xmlFiles.has(path)) {
      sheets.push({ name, path });
    }
  }

  if (sheets.length === 0) {
    for (const key of xmlFiles.keys()) {
      if (key.startsWith('xl/worksheets/sheet') && key.endsWith('.xml')) {
        sheets.push({ name: key, path: key });
      }
    }
  }

  // 4. Convert each worksheet into CSV lines
  const outputLines: string[] = [];
  for (const sheet of sheets) {
    outputLines.push(`=== Sheet: ${sheet.name} ===`);
    const sheetXml = xmlFiles.get(sheet.path) ?? '';
    for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const rowInner = rowMatch[1] ?? '';
      const cells: string[] = [];
      for (const cellMatch of rowInner.matchAll(
        /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
      )) {
        const attrs = cellMatch[1] ?? '';
        const body = cellMatch[2] ?? '';
        const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
        const colIdx = ref ? colLettersToIndex(ref) : cells.length;
        const cellType = attrs.match(/\bt="([^"]+)"/)?.[1] ?? 'n';
        const styleAttr = attrs.match(/\bs="(\d+)"/)?.[1];
        const styleIdx = styleAttr !== undefined ? Number(styleAttr) : null;

        let val = '';
        if (cellType === 'inlineStr') {
          const tMatch = body.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/);
          val = tMatch ? decodeXmlEntities(tMatch[1] ?? '') : '';
        } else {
          const vMatch = body.match(/<v>([\s\S]*?)<\/v>/);
          const rawV = vMatch ? (vMatch[1] ?? '').trim() : '';
          if (cellType === 's') {
            val = sharedStrings[Number(rawV)] ?? '';
          } else if (
            rawV !== '' &&
            styleIdx !== null &&
            dateStyleIndices.has(styleIdx) &&
            Number.isFinite(Number(rawV))
          ) {
            val = excelSerialToUtcString(Number(rawV));
          } else {
            val = decodeXmlEntities(rawV);
          }
        }

        while (cells.length <= colIdx) cells.push('');
        cells[colIdx] = val;
      }
      outputLines.push(cells.map(escapeCsvField).join(','));
    }
    outputLines.push('');
  }

  return outputLines.join('\n');
};

export const parseXtbFile = async (
  input: string | ArrayBuffer | Uint8Array,
): Promise<XtbParsedReport> => {
  if (typeof input === 'string') {
    return parseXtbReport(input);
  }
  const csvText = await xlsxToCsvText(input);
  return parseXtbReport(csvText);
};

