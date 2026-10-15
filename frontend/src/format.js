// Change 'INR' / 'en-IN' here if you want another currency.
const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const rupees = (value) => money.format(Number(value) || 0);

export function niceDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Today's date in the user's own timezone, as YYYY-MM-DD
export function today() {
  const t = new Date();
  t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
  return t.toISOString().slice(0, 10);
}

export const STATUS_LABELS = {
  planned: 'Planned',
  growing: 'Growing',
  harvested: 'Harvested',
};

// Water in the units Indian farmers use: lakh (1,00,000) and crore (1,00,00,000) litres
export function litres(value) {
  const v = Number(value) || 0;
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)} crore litres`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)} lakh litres`;
  return `${Math.round(v).toLocaleString('en-IN')} litres`;
}

export const kg = (value) => `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`;

// "40 to 50 kg" or just "1 kg" when both ends are the same
export function range(min, max, unit) {
  const f = (x) => Number(x).toLocaleString('en-IN', { maximumFractionDigits: 1 });
  return min === max ? `${f(min)} ${unit}` : `${f(min)} to ${f(max)} ${unit}`;
}

export function whenText(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  if (days === -1) return 'yesterday';
  return `${-days} days ago`;
}
