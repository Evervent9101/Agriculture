import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { rupees, niceDate, kg, litres, whenText } from '../format.js';

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/summary').then(setS).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">Could not load the dashboard: {error}</p>;
  if (!s) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>Farm overview</h1>

      <div className="tiles">
        <div className="tile">
          <span className="tile-label">Crops</span>
          <span className="tile-value">{s.crops.total}</span>
          <span className="tile-sub">
            {s.crops.growing} growing · {s.crops.planned} planned · {s.crops.harvested} harvested
          </span>
        </div>
        <div className="tile">
          <span className="tile-label">Land used</span>
          <span className="tile-value">{s.total_area}</span>
          <span className="tile-sub">acres</span>
        </div>
        <div className="tile">
          <span className="tile-label">Money spent</span>
          <span className="tile-value">{rupees(s.total_cost)}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Money earned</span>
          <span className="tile-value">{rupees(s.total_income)}</span>
        </div>
        <div className={`tile ${s.profit >= 0 ? 'good' : 'bad'}`}>
          <span className="tile-label">{s.profit >= 0 ? 'Profit' : 'Loss'}</span>
          <span className="tile-value">{rupees(Math.abs(s.profit))}</span>
        </div>
      </div>

      <section className="card">
        <h2>Jobs due this week</h2>
        {s.due_tasks.length === 0 && (
          <p className="muted">
            Nothing due. Add a sowing date to a crop (with a crop name like Wheat or Rice) and its jobs will show here.
          </p>
        )}
        <ul className="plain">
          {s.due_tasks.map((t, i) => (
            <li key={i} className={`task ${t.days_from_today < 0 ? 'past' : t.days_from_today <= 1 ? 'soon' : ''}`}>
              <div>
                <strong>{t.title}</strong> · <a href={`#/crops/${t.crop_id}`}>{t.crop_name}</a>
                {t.products && t.products.length > 0 && (
                  <div className="amounts">
                    {t.products.map((p) => <span key={p.name} className="amount">{p.name}: <strong>{kg(p.kg)}</strong></span>)}
                  </div>
                )}
                {t.water_litres ? <div className="amounts"><span className="amount">Water: <strong>about {litres(t.water_litres)}</strong></span></div> : null}
              </div>
              <span className={`due ${t.days_from_today < 0 ? 'past' : t.days_from_today <= 1 ? 'soon' : ''}`}>{whenText(t.days_from_today)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid2">
        <section className="card">
          <h2>Upcoming harvests</h2>
          {s.upcoming_harvests.length === 0 && (
            <p className="muted">No harvest dates set. Add an expected harvest date to a crop.</p>
          )}
          <ul className="plain">
            {s.upcoming_harvests.map((c) => (
              <li key={c.id}>
                <a href={`#/crops/${c.id}`}>{c.name}</a>
                <span className="muted">{niceDate(c.expected_harvest_date)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Latest work</h2>
          {s.recent_activities.length === 0 && <p className="muted">Nothing recorded yet.</p>}
          <ul className="plain">
            {s.recent_activities.map((a) => (
              <li key={a.id}>
                <span>
                  <strong>{a.type}</strong> on <a href={`#/crops/${a.crop_id}`}>{a.crop_name}</a>
                </span>
                <span className="muted">{niceDate(a.activity_date)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card">
        <h2>Where the money goes</h2>
        {s.cost_by_type.length === 0 && <p className="muted">Record some activities with costs to see this.</p>}
        <table className="table">
          <tbody>
            {s.cost_by_type.map((t) => (
              <tr key={t.type}>
                <td>{t.type}</td>
                <td className="muted">{t.count} time(s)</td>
                <td className="num">{rupees(t.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
