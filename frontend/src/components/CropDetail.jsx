import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { rupees, niceDate, today, STATUS_LABELS } from '../format.js';
import CropForm from './CropForm.jsx';

const NEW_TYPE = '__new__';
const DETAIL_IDEAS = ['Soil type', 'Seed supplier', 'Seed rate', 'Water source', 'Insurance', 'Previous crop'];

// ---------- details: anything extra the farmer wants to remember ----------
function Details({ crop, reload }) {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/crops/${crop.id}/details`, { method: 'POST', body: { label, value } });
      setLabel('');
      setValue('');
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    await api(`/details/${id}`, { method: 'DELETE' });
    reload();
  };

  return (
    <section className="card">
      <h2>More details</h2>
      {crop.details.length === 0 && (
        <p className="muted">Add anything you want to remember: soil type, seed supplier, water source…</p>
      )}
      <ul className="plain">
        {crop.details.map((d) => (
          <li key={d.id}>
            <span>
              <strong>{d.label}:</strong> {d.value}
            </span>
            <button className="link danger" onClick={() => remove(d.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={add}>
        <input list="detail-ideas" placeholder="What (e.g. Soil type)" value={label} onChange={(e) => setLabel(e.target.value)} required />
        <datalist id="detail-ideas">
          {DETAIL_IDEAS.map((i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
        <input placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} required />
        <button type="submit">Add</button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

// ---------- activities: the farming process ----------
function ActivityForm({ types, initial, submitLabel, onSubmit, onCancel }) {
  const blank = () => ({
    type: (initial && initial.type) || types[0] || NEW_TYPE,
    newType: '',
    activity_date: (initial && initial.activity_date) || today(),
    description: (initial && initial.description) || '',
    quantity: initial && initial.quantity != null ? initial.quantity : '',
    unit: (initial && initial.unit) || '',
    cost: initial && initial.cost ? initial.cost : '',
  });
  const [f, setF] = useState(blank);
  const [error, setError] = useState('');
  const set = (key) => (e) => setF({ ...f, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const type = f.type === NEW_TYPE ? f.newType.trim() : f.type;
    try {
      await onSubmit({
        type,
        activity_date: f.activity_date,
        description: f.description,
        quantity: f.quantity,
        unit: f.unit,
        cost: f.cost,
      });
      if (!initial) setF({ ...blank(), type: f.type === NEW_TYPE ? NEW_TYPE : f.type });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="row2">
        <label>
          What was done?
          <select value={f.type} onChange={set('type')}>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
            <option value={NEW_TYPE}>＋ Something else (type it)</option>
          </select>
        </label>
        <label>
          Date
          <input type="date" value={f.activity_date} onChange={set('activity_date')} required />
        </label>
      </div>
      {f.type === NEW_TYPE && (
        <label>
          New activity name
          <input value={f.newType} onChange={set('newType')} placeholder="e.g. Pruning" required />
        </label>
      )}
      <label>
        Details
        <input value={f.description} onChange={set('description')} placeholder="e.g. 50 kg urea, sprayed in the morning" />
      </label>
      <div className="row3">
        <label>
          Quantity
          <input type="number" min="0" step="0.01" value={f.quantity} onChange={set('quantity')} />
        </label>
        <label>
          Unit
          <input value={f.unit} onChange={set('unit')} placeholder="kg, litres, hours…" />
        </label>
        <label>
          Cost (₹)
          <input type="number" min="0" step="0.01" value={f.cost} onChange={set('cost')} />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function Activities({ crop, types, reload }) {
  const [editing, setEditing] = useState(null);

  const add = async (body) => {
    await api(`/crops/${crop.id}/activities`, { method: 'POST', body });
    reload();
  };
  const save = async (id, body) => {
    await api(`/activities/${id}`, { method: 'PUT', body });
    setEditing(null);
    reload();
  };
  const remove = async (a) => {
    if (!window.confirm(`Delete this ${a.type} record?`)) return;
    await api(`/activities/${a.id}`, { method: 'DELETE' });
    reload();
  };

  return (
    <section className="card">
      <h2>Work done (process)</h2>
      {crop.activities.length === 0 && <p className="muted">Nothing recorded yet. Add the first step below.</p>}
      <ul className="timeline">
        {crop.activities.map((a) =>
          editing === a.id ? (
            <li key={a.id}>
              <ActivityForm
                types={types}
                initial={a}
                submitLabel="Save changes"
                onSubmit={(body) => save(a.id, body)}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={a.id}>
              <div className="tl-head">
                <strong>{a.type}</strong>
                <span className="muted">{niceDate(a.activity_date)}</span>
              </div>
              {a.description && <div>{a.description}</div>}
              <div className="muted">
                {[a.quantity != null ? `${a.quantity} ${a.unit || ''}`.trim() : null, a.cost ? rupees(a.cost) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <div className="tl-actions">
                <button className="link" onClick={() => setEditing(a.id)}>Edit</button>
                <button className="link danger" onClick={() => remove(a)}>Delete</button>
              </div>
            </li>
          )
        )}
      </ul>
      <h3>Add work</h3>
      <ActivityForm types={types} submitLabel="Add" onSubmit={add} />
    </section>
  );
}

// ---------- sales ----------
function Sales({ crop, reload }) {
  const [f, setF] = useState({ sale_date: today(), quantity: '', unit: 'kg', price_per_unit: '', buyer: '' });
  const [error, setError] = useState('');
  const set = (key) => (e) => setF({ ...f, [key]: e.target.value });
  const preview = Number(f.quantity) * Number(f.price_per_unit);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/crops/${crop.id}/sales`, { method: 'POST', body: f });
      setF({ sale_date: today(), quantity: '', unit: f.unit, price_per_unit: '', buyer: '' });
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (s) => {
    if (!window.confirm('Delete this sale?')) return;
    await api(`/sales/${s.id}`, { method: 'DELETE' });
    reload();
  };

  return (
    <section className="card">
      <h2>Sales (income)</h2>
      {crop.sales.length === 0 && <p className="muted">No sales yet.</p>}
      <ul className="plain">
        {crop.sales.map((s) => (
          <li key={s.id}>
            <span>
              <strong>{rupees(s.amount)}</strong> · {s.quantity} {s.unit} at {rupees(s.price_per_unit)}
              {s.buyer ? ` to ${s.buyer}` : ''}
              <span className="muted"> · {niceDate(s.sale_date)}</span>
            </span>
            <button className="link danger" onClick={() => remove(s)}>Delete</button>
          </li>
        ))}
      </ul>
      <h3>Record a sale</h3>
      <form className="form" onSubmit={add}>
        <div className="row3">
          <label>
            Quantity
            <input type="number" min="0" step="0.01" value={f.quantity} onChange={set('quantity')} required />
          </label>
          <label>
            Unit
            <input value={f.unit} onChange={set('unit')} />
          </label>
          <label>
            Price per unit (₹)
            <input type="number" min="0" step="0.01" value={f.price_per_unit} onChange={set('price_per_unit')} required />
          </label>
        </div>
        <div className="row2">
          <label>
            Date
            <input type="date" value={f.sale_date} onChange={set('sale_date')} required />
          </label>
          <label>
            Buyer
            <input value={f.buyer} onChange={set('buyer')} placeholder="e.g. Local mandi" />
          </label>
        </div>
        {preview > 0 && <p className="muted">Total: {rupees(preview)}</p>}
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit">Add sale</button>
        </div>
      </form>
    </section>
  );
}

// ---------- the page ----------
export default function CropDetail({ id }) {
  const [crop, setCrop] = useState(null);
  const [types, setTypes] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  const reload = () =>
    Promise.all([api(`/crops/${id}`), api('/activity-types')])
      .then(([c, t]) => {
        setCrop(c);
        setTypes(t);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    reload();
  }, [id]);

  const saveCrop = async (form) => {
    await api(`/crops/${id}`, { method: 'PUT', body: form });
    setEditing(false);
    reload();
  };

  const removeCrop = async () => {
    if (!window.confirm(`Delete ${crop.name} and all its records? This cannot be undone.`)) return;
    await api(`/crops/${id}`, { method: 'DELETE' });
    window.location.hash = '#/crops';
  };

  if (error) {
    return (
      <>
        <p className="error">{error}</p>
        <a href="#/crops">← Back to crops</a>
      </>
    );
  }
  if (!crop) return <p className="muted">Loading…</p>;

  const s = crop.summary;

  return (
    <>
      <a href="#/crops">← All crops</a>

      <div className="titlebar">
        <h1>
          {crop.name} <span className={`badge ${crop.status}`}>{STATUS_LABELS[crop.status]}</span>
        </h1>
        {!editing && (
          <div className="actions">
            <button className="ghost" onClick={() => setEditing(true)}>Edit</button>
            <button className="ghost danger" onClick={removeCrop}>Delete</button>
          </div>
        )}
      </div>

      {editing ? (
        <section className="card">
          <h2>Edit crop</h2>
          <CropForm initial={crop} submitLabel="Save changes" onSubmit={saveCrop} onCancel={() => setEditing(false)} />
        </section>
      ) : (
        <section className="card">
          <dl className="facts">
            {crop.variety && (<><dt>Variety</dt><dd>{crop.variety}</dd></>)}
            {crop.field_name && (<><dt>Field</dt><dd>{crop.field_name}</dd></>)}
            {crop.area_acres != null && (<><dt>Area</dt><dd>{crop.area_acres} acres</dd></>)}
            {crop.season && (<><dt>Season</dt><dd>{crop.season}</dd></>)}
            {crop.sowing_date && (<><dt>Sown</dt><dd>{niceDate(crop.sowing_date)}</dd></>)}
            {crop.expected_harvest_date && (<><dt>Harvest</dt><dd>{niceDate(crop.expected_harvest_date)}</dd></>)}
          </dl>
          {crop.notes && <p>{crop.notes}</p>}
        </section>
      )}

      <div className="tiles">
        <div className="tile">
          <span className="tile-label">Spent</span>
          <span className="tile-value">{rupees(s.total_cost)}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Earned</span>
          <span className="tile-value">{rupees(s.total_income)}</span>
        </div>
        <div className={`tile ${s.profit >= 0 ? 'good' : 'bad'}`}>
          <span className="tile-label">{s.profit >= 0 ? 'Profit' : 'Loss'}</span>
          <span className="tile-value">{rupees(Math.abs(s.profit))}</span>
        </div>
      </div>

      <Details crop={crop} reload={reload} />
      <Activities crop={crop} types={types} reload={reload} />
      <Sales crop={crop} reload={reload} />
    </>
  );
}
