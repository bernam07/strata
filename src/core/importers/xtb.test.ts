import { describe, expect, it } from 'vitest';
import {
  extractTradeQuantityFromComment,
  parseXtbFile,
  parseXtbReport,
  xtbTickerToYahooSymbol,
} from './xtb';

const SAMPLE_XTB_CSV = `Account number,56759788,,,,,,,,,,,,,,,,,,,,,,,
Closed Positions,,,,,,,,,,,,,,,,,,,,,,,,
Date from (UTC),2026-09-15 23:00:00,,,,,,,,,,,,,,,,,,,,,,,
Date to (UTC),2026-10-16 17:40:00,,,,,,,,,,,,,,,,,,,,,,,
Instrument,Ticker,Category,Type,Volume,Open Price,Open Time (UTC),Close Price,Close Time (UTC),Product,Profit/Loss,Gross Profit,Purchase Value,Sale Value,Stop Loss,Take Profit,Commission,Margin,Swap,Rollover,Open Conversion Rate,Close Conversion Rate,Close Origin,Position ID,Comment
Galp Energia,GALP.PT,STOCK,BUY,1,0.001,2026-10-15 21:15:55,22.55,2026-10-16 07:41:16,My Trades,22.55,22.55,0,22.55,,,0,,,,,,iOS,2877690472,Refer A Friend Transfer In
Profit/loss,,,,,,,,,,22.55,22.55,,,,,,,,,,,,,
Account number,56759788,,,,,,,,
Cash Operations,,,,,,,,,
Date from (UTC),2026-09-15 23:00:00,,,,,,,,
Date to (UTC),2026-10-16 17:40:00,,,,,,,,
Type,Instrument,Ticker,Category,Time,Amount,ID,Comment,Product,Position ID
Stock purchase,Nike,NKE.US,STOCK,2026-10-16 07:42:21,-33.26,1482125113,OPEN BUY NKE.US 1/1.4007 @ 37.18,My Trades,2878233429
Stock purchase,Nike,NKE.US,STOCK,2026-10-16 07:42:20,-13.33,1482125112,OPEN BUY NKE.US 0.4007/1.4007 @ 37.19,My Trades,2878233429
Stock sell,Galp Energia,GALP.PT,STOCK,2026-10-16 07:41:17,22.55,1482124982,CLOSE BUY GALP.PT 1 @ 22.550,My Trades,2877690472
Deposit,,,,2026-10-15 21:15:29,25,1481880102,"BRIDGER_PAY deposit, BRIDGER_PAY provider transaction id=e15c2e2e-b630-452f-909f-817534c3710c, BRIDGER_PAY, id=2135662",My Trades,
Total,,,,,0.96000000000000441,,,,
Account number,56759788,,,,,,,,,,,,,,,,,
Open Positions,,,,,,,,,,,,,,,,,,
Data as of report generated,2026-10-16 17:40:03,,,,,,,,,,,,,,,,,
Product,Metric,Amount,Currency,,,,,,,,,,,,,,,
My Trades,Open position value,46.16,EUR,,,,,,,,,,,,,,,
My Trades,Open position profit,-0.43,EUR,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,
Note,Summary values and open positions are shown as of the report generation time,,,,,,,,,,,,,,,,,
Product,Instrument/Position,Ticker,Category,Type,Volume,Value,Current price,Open price,Open time (UTC),Stop Loss,Take Profit,Net Profit %,Net Profit,Gross Profit,Margin,Open Commission,Swap,Rollover
My Trades,Nike,NKE.US,STOCK,,1.4007,46.16,,37.18,,,,-0.92,-0.43,-0.43,,,,
My Trades,2878233429,NKE.US,,BUY,1.4007,46.16,37.18,37.18,2026-10-16 07:42:20,,,-0.92,-0.43,-0.43,,,,`;

const buildMinimalZip = (entries: Record<string, string>): Uint8Array => {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const cdParts: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = enc.encode(name);
    const dataBytes = enc.encode(content);
    const localHeader = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true); // stored (uncompressed)
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);
    localHeader.set(dataBytes, 30 + nameBytes.length);
    localParts.push(localHeader);

    const cdHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cdHeader.set(nameBytes, 46);
    cdParts.push(cdHeader);

    offset += localHeader.length;
  }

  const cdSize = cdParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, cdParts.length, true);
  ev.setUint16(10, cdParts.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const totalLen = offset + cdSize + 22;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of localParts) {
    out.set(p, pos);
    pos += p.length;
  }
  for (const p of cdParts) {
    out.set(p, pos);
    pos += p.length;
  }
  out.set(eocd, pos);
  return out;
};

describe('xtb importer', () => {
  it('maps XTB tickers to Yahoo Finance symbols', () => {
    expect(xtbTickerToYahooSymbol('NKE.US')).toEqual({
      bareTicker: 'NKE',
      yahooSymbol: 'NKE',
    });
    expect(xtbTickerToYahooSymbol('GALP.PT')).toEqual({
      bareTicker: 'GALP',
      yahooSymbol: 'GALP.LS',
    });
    expect(xtbTickerToYahooSymbol('SXR8.DE')).toEqual({
      bareTicker: 'SXR8',
      yahooSymbol: 'SXR8.DE',
    });
    expect(xtbTickerToYahooSymbol('VUAA.UK')).toEqual({
      bareTicker: 'VUAA',
      yahooSymbol: 'VUAA.L',
    });
  });

  it('extracts fill quantities from XTB trade comments', () => {
    expect(
      extractTradeQuantityFromComment('OPEN BUY NKE.US 1/1.4007 @ 37.18', 'buy'),
    ).toBe(1);
    expect(
      extractTradeQuantityFromComment(
        'OPEN BUY NKE.US 0.4007/1.4007 @ 37.19',
        'buy',
      ),
    ).toBe(0.4007);
    expect(
      extractTradeQuantityFromComment('CLOSE BUY GALP.PT 1 @ 22.550', 'sell'),
    ).toBe(-1);
  });

  it('parses closed positions, cash operations, and open positions from XTB report', () => {
    const parsed = parseXtbReport(SAMPLE_XTB_CSV);

    expect(parsed.accountNumber).toBe('56759788');
    expect(parsed.currency).toBe('EUR');
    expect(parsed.openPositionValue).toBe(46.16);
    expect(parsed.openPositionProfit).toBe(-0.43);
    expect(parsed.investedCost).toBeCloseTo(46.59, 4);
    expect(parsed.cashOperationsTotal).toBe(0.96);

    expect(parsed.closedPositions).toHaveLength(1);
    expect(parsed.closedPositions[0]).toMatchObject({
      positionId: '2877690472',
      instrument: 'Galp Energia',
      xtbTicker: 'GALP.PT',
      volume: 1,
      saleValue: 22.55,
      profitLoss: 22.55,
    });

    expect(parsed.cashOperations).toHaveLength(4);
    expect(parsed.cashOperations[0]).toMatchObject({
      id: '1482125113',
      externalId: 'xtb:1482125113',
      kind: 'buy',
      xtbTicker: 'NKE.US',
      amount: -33.26,
      quantity: 1,
    });
    expect(parsed.cashOperations[1]).toMatchObject({
      id: '1482125112',
      externalId: 'xtb:1482125112',
      kind: 'buy',
      xtbTicker: 'NKE.US',
      amount: -13.33,
      quantity: 0.4007,
    });
    expect(parsed.cashOperations[2]).toMatchObject({
      id: '1482124982',
      externalId: 'xtb:1482124982',
      kind: 'sell',
      xtbTicker: 'GALP.PT',
      amount: 22.55,
      quantity: -1,
    });
    expect(parsed.cashOperations[3]).toMatchObject({
      id: '1481880102',
      externalId: 'xtb:1481880102',
      kind: 'deposit',
      amount: 25,
      quantity: null,
    });

    expect(parsed.openPositions).toHaveLength(1);
    expect(parsed.openPositions[0]).toMatchObject({
      xtbTicker: 'NKE.US',
      bareTicker: 'NKE',
      yahooSymbol: 'NKE',
      name: 'Nike',
      category: 'STOCK',
      quantity: 1.4007,
      marketValueEur: 46.16,
      netProfitEur: -0.43,
    });
    expect(parsed.openPositions[0]!.costBasisEur).toBeCloseTo(46.59, 4);

    expect(parsed.instruments.get('NKE.US')?.name).toBe('Nike');
    expect(parsed.instruments.get('GALP.PT')?.name).toBe('Galp Energia');
  });

  it('parses binary .xlsx XTB workbooks with sharedStrings and Excel serial dates', async () => {
    const xlsxBytes = buildMinimalZip({
      'xl/workbook.xml': `<workbook><sheets><sheet name="Open Positions" r:id="rId1"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
      'xl/styles.xml': `<styleSheet><numFmts count="1"><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="165"/></cellXfs></styleSheet>`,
      'xl/sharedStrings.xml': `<sst><si><t>Account number</t></si><si><t>56759788</t></si><si><t>Open Positions</t></si><si><t>Data as of report generated</t></si><si><t>Product</t></si><si><t>Instrument/Position</t></si><si><t>Ticker</t></si><si><t>Category</t></si><si><t>Type</t></si><si><t>Volume</t></si><si><t>Value</t></si><si><t>Current price</t></si><si><t>Open price</t></si><si><t>Open time (UTC)</t></si><si><t>Net Profit</t></si><si><t>My Trades</t></si><si><t>Nike</t></si><si><t>NKE.US</t></si><si><t>STOCK</t></si></sst>`,
      'xl/worksheets/sheet1.xml': `<worksheet><sheetData>
        <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
        <row r="2"><c r="A2" t="s"><v>2</v></c></row>
        <row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" s="1" t="n"><v>46311.736145833336</v></c></row>
        <row r="4"><c r="A4" t="s"><v>4</v></c><c r="B4" t="s"><v>5</v></c><c r="C4" t="s"><v>6</v></c><c r="D4" t="s"><v>7</v></c><c r="E4" t="s"><v>8</v></c><c r="F4" t="s"><v>9</v></c><c r="G4" t="s"><v>10</v></c><c r="H4" t="s"><v>11</v></c><c r="I4" t="s"><v>12</v></c><c r="J4" t="s"><v>13</v></c><c r="K4" t="s"><v>14</v></c></row>
        <row r="5"><c r="A5" t="s"><v>15</v></c><c r="B5" t="s"><v>16</v></c><c r="C5" t="s"><v>17</v></c><c r="D5" t="s"><v>18</v></c><c r="F5" t="n"><v>1.4007</v></c><c r="G5" t="n"><v>46.16</v></c><c r="I5" t="n"><v>37.18</v></c><c r="K5" t="n"><v>-0.43</v></c></row>
      </sheetData></worksheet>`,
    });

    const parsed = await parseXtbFile(xlsxBytes);
    expect(parsed.accountNumber).toBe('56759788');
    expect(parsed.openPositions).toHaveLength(1);
    expect(parsed.openPositions[0]).toMatchObject({
      xtbTicker: 'NKE.US',
      name: 'Nike',
      quantity: 1.4007,
      marketValueEur: 46.16,
      netProfitEur: -0.43,
    });
    expect(parsed.openPositions[0]!.costBasisEur).toBeCloseTo(46.59, 4);
  });
});

