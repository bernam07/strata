import { describe, expect, it } from 'vitest';
import {
  extractTradeQuantityFromComment,
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

  it('parses closed positions, cash operations, and open positions from XTB CSV report', () => {
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
});
