import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { niceDate, litres, kg, range, whenText } from '../format.js';

const ICONS = {
  prep: '🚜',
  sowing: '🌱',
  fertilizer: '🧪',
  irrigation: '💧',
  weeding: '🌿',
  pest: '🐛',
  harvest: '🌾',
  other: '📝',
};

function TaskExtras({ task }) {
  return (
    <>
      {task.products && task.products.length > 0 && (
        <div className="amounts">
          {task.products.map((p) => (
            <span key={p.name} className="amount">{p.name}: <strong>{kg(p.kg)}</strong></span>
          ))}
        </div>
      )}
      {task.water_litres ? (
        <div className="amounts">
          <span className="amount">Water: <strong>about {litres(task.water_litres)}</strong> ({task.depth_cm} cm)</span>
        </div>
      ) : null}
    </>
  );
}

// Tells the farmer how much seed, fertilizer and water the crop needs and when to do each job.
export default function Guidance({ crop }) {
  const [g, setG] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setG(null);
    setError('');
    api(`/crops/${crop.id}/guidance`).then(setG).catch((e) => setError(e.message));
  }, [crop.id, crop.name, crop.area_acres, crop.sowing_date]);

  if (error) return <section className="card"><h2>Crop guide</h2><p className="error">{error}</p></section>;
  if (!g) return <section className="card"><h2>Crop guide</h2><p className="muted">Loading…</p></section>;

  if (!g.matched) {
    return (
      <section className="card">
        <h2>Crop guide</h2>
        <p className="muted">
          There is no built-in guide for “{g.crop_name}” yet. Guides are available for these crops. Use one of these
          names for the crop to see how much seed, fertilizer and water it needs:
        </p>
        <div className="chips-static">
          {g.available.map((c) => <span key={c.slug} className="pill">{c.name}</span>)}
        </div>
      </section>
    );
  }

  const t = g.total;
  const acres = g.area_acres;
  const upcoming = g.tasks.filter((x) => x.days_from_today !== undefined && x.days_from_today >= -3).slice(0, 3);

  return (
    <section className="card guide">
      <h2>Crop guide: {g.guide_name}</h2>
      <p className="muted">
        {g.season}. Ready in about {g.duration_days[0]} to {g.duration_days[1]} days.
      </p>

      {g.per_acre_only && (
        <p className="notice">
          Add the field <strong>area</strong> (Edit this crop) to see the amounts for your land. The numbers below are
          for <strong>1 acre</strong>.
        </p>
      )}
      {!crop.sowing_date && (
        <p className="notice">
          Add the <strong>sowing date</strong> (Edit this crop) to get a dated plan showing when each job is due.
        </p>
      )}
      {g.das_from === 'transplanting' && (
        <p className="notice">
          This crop is planted as seedlings. Enter the day you <strong>transplant</strong> the seedlings as the sowing
          date. The nursery is sown earlier (shown as a negative day below).
        </p>
      )}

      <h3>What you need for {acres ? `${acres} acre${acres === 1 ? '' : 's'}` : '1 acre'}</h3>
      <div className="needs">
        <div className="need">
          <span className="need-label">🌱 Seed</span>
          <span className="need-value">{range(t.seed.min, t.seed.max, t.seed.unit)}</span>
          <span className="need-sub">{g.seed_note}</span>
        </div>
        <div className="need">
          <span className="need-label">🧪 Fertilizer (whole season)</span>
          {t.products.map((p) => (
            <span key={p.name} className="need-value">{p.name}: {kg(p.kg)}</span>
          ))}
          {t.extras.map((p) => (
            <span key={p.name} className="need-value">{p.name}: {kg(p.kg)}</span>
          ))}
          <span className="need-sub">
            Nutrients: {t.nutrients.n} kg nitrogen, {t.nutrients.p} kg phosphorus, {t.nutrients.k} kg potash
          </span>
        </div>
        <div className="need">
          <span className="need-label">🐄 Farmyard manure (FYM)</span>
          <span className="need-value">{t.fym_tonnes} tonnes</span>
          <span className="need-sub">Spread before the last ploughing</span>
        </div>
        <div className="need">
          <span className="need-label">💧 Water (whole season)</span>
          <span className="need-value">
            {litres(t.water_litres.min)} to {litres(t.water_litres.max)}
          </span>
          <span className="need-sub">Rain counts towards this</span>
        </div>
        <div className="need">
          <span className="need-label">🌾 Expected harvest</span>
          <span className="need-value">{range(t.yield_quintal.min, t.yield_quintal.max, 'quintal')}</span>
          <span className="need-sub">In a good season, with good care</span>
        </div>
      </div>

      {upcoming.length > 0 && (
        <>
          <h3>Coming up</h3>
          <ul className="plain">
            {upcoming.map((x, i) => (
              <li key={i} className={`task ${x.when}`}>
                <div>
                  <strong>{ICONS[x.type]} {x.title}</strong>
                  <div className="muted">{x.detail}</div>
                  <TaskExtras task={x} />
                </div>
                <span className={`due ${x.when}`}>{whenText(x.days_from_today)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Full plan, day by day</h3>
      <ul className="plain timeline">
        {g.tasks.map((x, i) => (
          <li key={i} className={`task ${x.when || ''}`}>
            <div>
              <span className="day">
                {x.das < 0 ? `${-x.das} days before` : x.das === 0 ? 'Day 0' : `Day ${x.das}`}
                {x.date ? ` · ${niceDate(x.date)}` : ''}
              </span>
              <strong>{ICONS[x.type]} {x.title}</strong>
              <div className="muted">{x.detail}</div>
              <TaskExtras task={x} />
            </div>
          </li>
        ))}
      </ul>

      <p className="muted fine">
        These are typical figures for irrigated farms in India, worked out for your area. Your soil, variety and
        weather can change them. A soil test and advice from your local Krishi Vigyan Kendra (KVK) or agriculture
        officer will give the exact amounts for your field. Always follow the label and the officer’s advice for any
        spray.
      </p>
    </section>
  );
}
