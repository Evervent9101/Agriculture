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
