import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { rupees, niceDate, STATUS_LABELS } from '../format.js';
import CropForm from './CropForm.jsx';

export default function CropList() {
  const [crops, setCrops] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = () =>
    api('/crops')
      .then(setCrops)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const addCrop = async (form) => {
    const created = await api('/crops', { method: 'POST', body: form });
    window.location.hash = `#/crops/${created.id}`;
  };

  if (error) return <p className="error">Could not load crops: {error}</p>;
  if (!crops) return <p className="muted">Loading…</p>;

  const shown = crops.filter(
    (c) =>
      (filter === 'all' || c.status === filter) &&
      `${c.name} ${c.variety || ''} ${c.field_name || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="titlebar">
        <h1>Crops</h1>
        {!adding && <button onClick={() => setAdding(true)}>+ Add crop</button>}
      </div>

      {adding && (
        <section className="card">
          <h2>New crop</h2>
          <CropForm submitLabel="Save crop" onSubmit={addCrop} onCancel={() => setAdding(false)} />
        </section>
      )}

      <div className="filters">
        <input
          className="search"
          placeholder="Search crops…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="chips">
          {['all', 'planned', 'growing', 'harvested'].map((s) => (
            <button
              key={s}
              className={`chip ${filter === s ? 'on' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {crops.length === 0 && !adding && (
        <p className="muted">No crops yet. Press “Add crop” to record your first one.</p>
      )}
      {crops.length > 0 && shown.length === 0 && <p className="muted">No crops match.</p>}

      <div className="cards">
        {shown.map((c) => (
          <a key={c.id} className="crop" href={`#/crops/${c.id}`}>
            <div className="crop-head">
              <strong>{c.name}</strong>
              <span className={`badge ${c.status}`}>{STATUS_LABELS[c.status]}</span>
            </div>
            <div className="muted">
              {[c.variety, c.field_name, c.area_acres ? `${c.area_acres} acres` : null, c.season]
                .filter(Boolean)
                .join(' · ') || 'No details yet'}
            </div>
            {c.expected_harvest_date && c.status !== 'harvested' && (
              <div className="muted">Harvest: {niceDate(c.expected_harvest_date)}</div>
            )}
            <div className="crop-money">
              <span>Spent {rupees(c.total_cost)}</span>
              <span>Earned {rupees(c.total_income)}</span>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
