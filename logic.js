// All the money and date rules. No screen code here, so it can be tested on its own.

const FIRST_RATE_DATE = '0000-01-01';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function defaultState() {
  return { entries: {}, rates: [{ from: FIRST_RATE_DATE, rate: 1.3 }] };
}

// Returns a number, null for a blank box, or NaN for anything that isn't a positive number.
export function parseNumber(text) {
  const cleaned = String(text).trim()
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[,٫]/g, '.');
  if (cleaned === '') return null;
  return /^(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : NaN;
}

export function rateFor(rates, date) {
  let current = rates[0].rate;
  for (const { from, rate } of rates) {
    if (from <= date) current = rate;
  }
  return current;
}

export function setRate(rates, from, rate) {
  return [...rates.filter(r => r.from !== from), { from, rate }]
    .sort((a, b) => a.from.localeCompare(b.from));
}

export function removeRate(rates, from) {
  return from === FIRST_RATE_DATE ? rates : rates.filter(r => r.from !== from);
}

export function dayPay(state, date) {
  const entry = state.entries[date];
  return entry ? entry.kg * rateFor(state.rates, date) : 0;
}

// Pay is added up unrounded and only rounded for display, so a month matches total kilos x rate.
export function monthSummary(state, month) {
  const days = Object.keys(state.entries)
    .filter(date => monthKey(date) === month)
    .sort()
    .reverse()
    .map(date => ({ date, ...state.entries[date], pay: dayPay(state, date) }));
  const total = field => days.reduce((sum, day) => sum + day[field], 0);
  const pay = total('pay');
  const spent = total('spent');
  return { kg: total('kg'), pay, spent, profit: pay - spent, days };
}

export function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function monthKey(date) {
  return date.slice(0, 7);
}

export function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthKey(dateKey(new Date(year, monthNumber - 1 + delta, 1)));
}

export function formatMoney(amount) {
  // toPrecision clears floating point noise, so 1.365 rounds up to 1.37 rather than down.
  const agorot = Math.round(Number((Math.abs(amount) * 100).toPrecision(12)));
  const digits = agorot % 100 === 0 ? 0 : 2;
  const text = (agorot / 100).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${amount < 0 && agorot > 0 ? '−' : ''}₪${text}`;
}

export function formatKg(kg) {
  return Number(kg.toFixed(2)).toLocaleString('en-US');
}

export function parseBackup(text) {
  const data = JSON.parse(text);
  const isAmount = value => Number.isFinite(value) && value >= 0;
  const entriesOk = data.entries && typeof data.entries === 'object'
    && Object.entries(data.entries).every(([date, entry]) =>
      DATE_PATTERN.test(date) && isAmount(entry?.kg) && isAmount(entry?.spent));
  const ratesOk = Array.isArray(data.rates)
    && data.rates[0]?.from === FIRST_RATE_DATE
    && data.rates.every(r => DATE_PATTERN.test(r?.from) && isAmount(r?.rate) && r.rate > 0);
  if (!entriesOk || !ratesOk) throw new Error('Not a Kilo Pay backup');
  return { entries: data.entries, rates: data.rates };
}
