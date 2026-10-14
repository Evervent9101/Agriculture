import React, { useState } from 'react';

const SEASONS = ['Kharif', 'Rabi', 'Zaid', 'Perennial'];

// Used for both "add crop" and "edit crop".
export default function CropForm({ initial = {}, submitLabel, onSubmit, onCancel }) {
  const [f, setF] = useState({
    name: initial.name || '',
    variety: initial.variety || '',
    field_name: initial.field_name || '',
    area_acres: initial.area_acres ?? '',
    season: initial.season || '',
    sowing_date: initial.sowing_date || '',
    expected_harvest_date: initial.expected_harvest_date || '',
    status: initial.status || 'planned',
    notes: initial.notes || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setF({ ...f, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(f);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Crop name *
        <input value={f.name} onChange={set('name')} placeholder="e.g. Wheat" required />
      </label>
      <div className="row2">
        <label>
          Variety
          <input value={f.variety} onChange={set('variety')} placeholder="e.g. HD-2967" />
        </label>
        <label>
          Field / plot
          <input value={f.field_name} onChange={set('field_name')} placeholder="e.g. North field" />
        </label>
      </div>
      <div className="row2">
        <label>
          Area (acres)
          <input type="number" min="0" step="0.01" value={f.area_acres} onChange={set('area_acres')} />
        </label>
        <label>
          Season
          <input list="seasons" value={f.season} onChange={set('season')} placeholder="Kharif, Rabi…" />
          <datalist id="seasons">
            {SEASONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
      </div>
      <div className="row2">
        <label>
          Sowing date
          <input type="date" value={f.sowing_date} onChange={set('sowing_date')} />
        </label>
        <label>
          Expected harvest
          <input type="date" value={f.expected_harvest_date} onChange={set('expected_harvest_date')} />
        </label>
      </div>
      <label>
        Status
        <select value={f.status} onChange={set('status')}>
          <option value="planned">Planned</option>
          <option value="growing">Growing</option>
          <option value="harvested">Harvested</option>
        </select>
      </label>
      <label>
        Notes
        <textarea rows="3" value={f.notes} onChange={set('notes')} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="submit" disabled={busy}>{submitLabel}</button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </form>
  );
}
