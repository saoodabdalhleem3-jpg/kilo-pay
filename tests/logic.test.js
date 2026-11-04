import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultState, parseNumber, rateFor, setRate, removeRate, dayPay, monthSummary,
  dateKey, monthKey, shiftMonth, formatMoney, formatKg, parseBackup,
} from '../logic.js';

const stateWith = (entries, rates = [{ from: '0000-01-01', rate: 1.3 }]) => ({ entries, rates });

test('a fresh app pays 1.3 shekels per kilo', () => {
  assert.equal(rateFor(defaultState().rates, '2026-11-04'), 1.3);
});

test('120 kg pays 156 shekels', () => {
  assert.equal(formatMoney(dayPay(stateWith({ '2026-11-04': { kg: 120, spent: 0 } }), '2026-11-04')), '₪156');
});

test('month summary adds up kilos, pay, spending and profit', () => {
  const s = monthSummary(stateWith({
    '2026-11-01': { kg: 100, spent: 30 },
    '2026-11-02': { kg: 200, spent: 20 },
  }), '2026-11');
  assert.equal(s.kg, 300);
  assert.equal(Math.round(s.pay * 100) / 100, 390);
  assert.equal(s.spent, 50);
  assert.equal(Math.round(s.profit * 100) / 100, 340);
});

test('month summary ignores days from other months', () => {
  const s = monthSummary(stateWith({
    '2026-10-31': { kg: 500, spent: 500 },
    '2026-11-01': { kg: 100, spent: 0 },
    '2026-12-01': { kg: 500, spent: 500 },
  }), '2026-11');
  assert.equal(s.kg, 100);
  assert.equal(s.spent, 0);
});

test('month summary lists days newest first', () => {
  const s = monthSummary(stateWith({
    '2026-11-01': { kg: 1, spent: 0 },
    '2026-11-03': { kg: 3, spent: 0 },
    '2026-11-02': { kg: 2, spent: 0 },
  }), '2026-11');
  assert.deepEqual(s.days.map(d => d.date), ['2026-11-03', '2026-11-02', '2026-11-01']);
});

test('month pay is not thrown off by rounding each day', () => {
  // 3 days of 0.35 kg: each day is 0.455, the month is 1.365 -> 1.37, not 3 x 0.46
  const s = monthSummary(stateWith({
    '2026-11-01': { kg: 0.35, spent: 0 },
    '2026-11-02': { kg: 0.35, spent: 0 },
    '2026-11-03': { kg: 0.35, spent: 0 },
  }), '2026-11');
  assert.equal(formatMoney(s.pay), '₪1.37');
});

test('a new rate leaves earlier days at the old rate', () => {
  const rates = setRate(defaultState().rates, '2026-11-10', 1.5);
  const s = stateWith({
    '2026-11-09': { kg: 100, spent: 0 },
    '2026-11-10': { kg: 100, spent: 0 },
  }, rates);
  assert.equal(formatMoney(dayPay(s, '2026-11-09')), '₪130');
  assert.equal(formatMoney(dayPay(s, '2026-11-10')), '₪150');
});

test('setting a rate twice on the same start date replaces it', () => {
  const rates = setRate(setRate(defaultState().rates, '2026-11-10', 1.5), '2026-11-10', 1.4);
  assert.equal(rates.length, 2);
  assert.equal(rateFor(rates, '2026-11-10'), 1.4);
});

test('rates stay in date order when one is added out of order', () => {
  const rates = setRate(setRate(defaultState().rates, '2026-12-01', 1.6), '2026-11-01', 1.5);
  assert.equal(rateFor(rates, '2026-11-15'), 1.5);
  assert.equal(rateFor(rates, '2026-12-15'), 1.6);
});

test('removing a rate falls back to the one before it', () => {
  const rates = removeRate(setRate(defaultState().rates, '2026-11-10', 1.5), '2026-11-10');
  assert.equal(rateFor(rates, '2026-11-20'), 1.3);
});

test('the first rate can never be removed', () => {
  const start = defaultState().rates;
  assert.deepEqual(removeRate(start, start[0].from), start);
});

test('parseNumber reads a plain decimal', () => {
  assert.equal(parseNumber('120.5'), 120.5);
});

test('parseNumber accepts a comma as the decimal mark', () => {
  assert.equal(parseNumber('120,5'), 120.5);
});

test('parseNumber accepts Arabic-Indic digits', () => {
  assert.equal(parseNumber('١٢٠٫٥'), 120.5);
});

test('parseNumber treats a blank box as nothing typed', () => {
  assert.equal(parseNumber('  '), null);
});

test('parseNumber refuses text that is not a number', () => {
  assert.ok(Number.isNaN(parseNumber('12kg')));
});

test('parseNumber refuses negative numbers', () => {
  assert.ok(Number.isNaN(parseNumber('-5')));
});

test('formatMoney shows agorot only when there are some', () => {
  assert.equal(formatMoney(153.4), '₪153.40');
  assert.equal(formatMoney(3432), '₪3,432');
});

test('formatMoney shows a loss with a minus sign', () => {
  assert.equal(formatMoney(-50), '−₪50');
});

test('formatMoney never shows a negative zero', () => {
  assert.equal(formatMoney(-0.001), '₪0');
});

test('formatKg trims needless decimals', () => {
  assert.equal(formatKg(2640), '2,640');
  assert.equal(formatKg(120.5), '120.5');
});

test('dateKey uses the local calendar day, late at night too', () => {
  assert.equal(dateKey(new Date(2026, 10, 4, 23, 59)), '2026-11-04');
  assert.equal(dateKey(new Date(2026, 10, 4, 0, 1)), '2026-11-04');
});

test('monthKey cuts a date down to its month', () => {
  assert.equal(monthKey('2026-11-04'), '2026-11');
});

test('shiftMonth crosses year boundaries both ways', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});

test('a backup can be read back exactly', () => {
  const state = stateWith({ '2026-11-04': { kg: 120, spent: 35 } });
  assert.deepEqual(parseBackup(JSON.stringify(state)), state);
});

test('a backup that is not JSON is refused', () => {
  assert.throws(() => parseBackup('hello'));
});

test('a backup with no first rate is refused', () => {
  assert.throws(() => parseBackup(JSON.stringify({ entries: {}, rates: [] })));
});

test('a backup with a bad date is refused', () => {
  assert.throws(() => parseBackup(JSON.stringify(stateWith({ yesterday: { kg: 1, spent: 0 } }))));
});

test('a backup with a non-number kilo value is refused', () => {
  assert.throws(() => parseBackup(JSON.stringify(stateWith({ '2026-11-04': { kg: 'lots', spent: 0 } }))));
});
