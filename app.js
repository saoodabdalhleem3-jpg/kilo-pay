import {
  defaultState, parseNumber, rateFor, setRate, removeRate, monthSummary,
  dateKey, monthKey, shiftMonth, formatMoney, formatKg, parseBackup,
} from './logic.js';

const STORAGE_KEY = 'kilo-pay';
const LAST_BACKUP_KEY = 'kilo-pay-last-backup';

const $ = id => document.getElementById(id);
const today = () => dateKey(new Date());
const toDate = key => new Date(...key.split('-').map((part, i) => Number(part) - (i === 1 ? 1 : 0)));
const dateText = (key, options) => toDate(key).toLocaleDateString('en-GB', options);

let state = load();
let viewMonth = monthKey(today());

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseBackup(saved) : defaultState();
  } catch {
    return defaultState();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    alert('Your phone could not save this. Please try again.');
  }
}

function render() {
  const summary = monthSummary(state, viewMonth);
  const isCurrentMonth = viewMonth === monthKey(today());
  const firstOfMonth = `${viewMonth}-01`;
  const monthName = dateText(firstOfMonth, { month: 'long' });

  $('month-title').textContent = dateText(firstOfMonth, { month: 'long', year: 'numeric' });
  $('next-month').disabled = isCurrentMonth;
  $('profit-label').textContent = `${monthName} profit${isCurrentMonth ? ' so far' : ''}`;
  $('profit').textContent = formatMoney(summary.profit);
  $('profit').classList.toggle('loss', summary.profit < 0);
  $('total-pay').textContent = formatMoney(summary.pay);
  $('total-spent').textContent = formatMoney(summary.spent);
  $('total-kg').textContent = formatKg(summary.kg);
  $('log-today').textContent = state.entries[today()] ? 'Edit today' : '+ Log today';

  $('days').replaceChildren(...summary.days.map(dayRow));
  $('no-days').hidden = summary.days.length > 0;
}

function dayRow(day) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  const cell = (className, text) => {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
  };
  button.className = 'day';
  button.append(
    cell('day-date', dateText(day.date, { weekday: 'short', day: 'numeric', month: 'short' })),
    cell('day-kg', `${formatKg(day.kg)} kg`),
    cell('day-pay', formatMoney(day.pay)),
    cell('day-spent', `Spent ${formatMoney(day.spent)}`),
  );
  button.addEventListener('click', () => openLog(day.date));
  item.append(button);
  return item;
}

function openLog(date) {
  $('log-date').max = today();
  $('log-date').value = date;
  fillLog();
  $('log-sheet').showModal();
}

// The form always shows the day in the date box, so picking a logged day edits it instead of overwriting it.
function fillLog() {
  const entry = state.entries[$('log-date').value];
  $('log-kg').value = entry ? entry.kg : '';
  $('log-spent').value = entry ? entry.spent : '';
  $('log-delete').hidden = !entry;
  $('log-error').textContent = '';
  updatePreview();
}

function updatePreview() {
  const date = $('log-date').value;
  const kg = parseNumber($('log-kg').value);
  const valid = date && kg !== null && !Number.isNaN(kg);
  if (!valid) {
    $('log-preview').textContent = '';
    return;
  }
  const rate = rateFor(state.rates, date);
  $('log-preview').textContent = `Pay: ${formatMoney(kg * rate)} (${formatKg(kg)} kg × ${formatMoney(rate)})`;
}

function saveLog(event) {
  event.preventDefault();
  const date = $('log-date').value;
  const kg = parseNumber($('log-kg').value);
  const spent = parseNumber($('log-spent').value);

  let problem = '';
  if (!date) problem = 'Pick a date.';
  else if (date > today()) problem = 'That date is in the future.';
  else if (Number.isNaN(kg)) problem = 'Kilos must be a number, like 120.5';
  else if (Number.isNaN(spent)) problem = 'Spent must be a number, like 35';
  else if (kg === null && spent === null) problem = 'Type your kilos, or what you spent.';
  $('log-error').textContent = problem;
  if (problem) return;

  state.entries[date] = { kg: kg ?? 0, spent: spent ?? 0 };
  persist();
  viewMonth = monthKey(date);
  render();
  $('log-sheet').close();
}

function deleteLog() {
  const date = $('log-date').value;
  if (!confirm(`Delete ${dateText(date, { day: 'numeric', month: 'long' })}?`)) return;
  delete state.entries[date];
  persist();
  render();
  $('log-sheet').close();
}

function openSettings() {
  renderSettings();
  $('rate-value').value = '';
  $('rate-from').value = today();
  $('rate-error').textContent = '';
  $('settings-sheet').showModal();
}

function renderSettings() {
  $('rates').replaceChildren(...state.rates.map((rate, index) => {
    const item = document.createElement('li');
    const text = document.createElement('span');
    const start = index === 0
      ? 'from the start'
      : `from ${dateText(rate.from, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    text.textContent = `${formatMoney(rate.rate)} per kilo ${start}`;
    item.append(text);
    if (index > 0) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        if (!confirm(`Remove this rate? Days from ${rate.from} go back to the rate before it.`)) return;
        state.rates = removeRate(state.rates, rate.from);
        persist();
        render();
        renderSettings();
      });
      item.append(remove);
    }
    return item;
  }));

  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  $('backup-status').textContent = lastBackup
    ? `Last backup: ${dateText(lastBackup, { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'No backup yet. Without one, your numbers are lost if you lose your phone.';
}

function saveRate(event) {
  event.preventDefault();
  const rate = parseNumber($('rate-value').value);
  const from = $('rate-from').value;
  if (!rate) {
    $('rate-error').textContent = 'Type the new rate, like 1.5';
    return;
  }
  if (!from) {
    $('rate-error').textContent = 'Pick the day it starts.';
    return;
  }
  state.rates = setRate(state.rates, from, rate);
  persist();
  render();
  renderSettings();
  $('rate-value').value = '';
  $('rate-error').textContent = '';
}

async function saveBackup() {
  const name = `kilo-pay-backup-${today()}.json`;
  const file = new File([JSON.stringify(state, null, 2)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      if (error.name !== 'AbortError') alert('The backup could not be saved. Please try again.');
      return;
    }
  } else {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  localStorage.setItem(LAST_BACKUP_KEY, today());
  renderSettings();
}

async function restoreBackup(event) {
  const [file] = event.target.files;
  event.target.value = '';
  if (!file) return;
  let restored;
  try {
    restored = parseBackup(await file.text());
  } catch {
    alert('That file is not a Kilo Pay backup.');
    return;
  }
  const days = Object.keys(restored.entries).length;
  if (!confirm(`Replace everything in the app with the ${days} days in this backup?`)) return;
  state = restored;
  persist();
  render();
  renderSettings();
}

$('prev-month').addEventListener('click', () => { viewMonth = shiftMonth(viewMonth, -1); render(); });
$('next-month').addEventListener('click', () => { viewMonth = shiftMonth(viewMonth, 1); render(); });
$('log-today').addEventListener('click', () => openLog(today()));
$('open-settings').addEventListener('click', openSettings);

$('log-form').addEventListener('submit', saveLog);
$('log-date').addEventListener('change', fillLog);
$('log-kg').addEventListener('input', updatePreview);
$('log-cancel').addEventListener('click', () => $('log-sheet').close());
$('log-delete').addEventListener('click', deleteLog);

$('rate-form').addEventListener('submit', saveRate);
$('settings-close').addEventListener('click', () => $('settings-sheet').close());
$('backup-save').addEventListener('click', saveBackup);
$('backup-restore').addEventListener('click', () => $('backup-file').click());
$('backup-file').addEventListener('change', restoreBackup);

// The app can stay open overnight, so "today" has to be worked out again when it comes back.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});

render();
navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
