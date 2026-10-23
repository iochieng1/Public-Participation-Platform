import { useEffect, useState } from 'react';
import { api, type County } from './api';
import { useApi } from './hooks';

/** County -> sub-county -> ward cascade. Calls onChange with a ward id (or '' when incomplete). */
export function WardPicker({ onChange, countyOnly = false, onCounty }: {
  onChange?: (wardId: string) => void;
  countyOnly?: boolean;
  onCounty?: (countyId: number | null) => void;
}) {
  const { data: counties } = useApi<County[]>('/counties');
  const [countyId, setCountyId] = useState<number | null>(null);
  const [county, setCounty] = useState<County | null>(null);
  const [subId, setSubId] = useState('');

  useEffect(() => {
    setCounty(null);
    setSubId('');
    onChange?.('');
    onCounty?.(countyId);
    if (countyId && !countyOnly) api<County>(`/counties/${countyId}`).then(setCounty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countyId]);

  const sub = county?.subCounties?.find((s) => s.id === subId);

  return (
    <div className="row">
      <select value={countyId ?? ''} onChange={(e) => setCountyId(Number(e.target.value) || null)} aria-label="County">
        <option value="">{countyOnly ? 'All counties' : 'County…'}</option>
        {counties?.map((c) => (
          <option key={c.id} value={c.id}>
            {String(c.id).padStart(3, '0')} {c.name}{c.live ? '' : countyOnly ? '' : ' (not yet live)'}
          </option>
        ))}
      </select>
      {!countyOnly && county && (
        county.subCounties?.length ? (
          <select value={subId} onChange={(e) => { setSubId(e.target.value); onChange?.(''); }} aria-label="Sub-county">
            <option value="">Sub-county…</option>
            {county.subCounties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : <span className="muted">This county is not on the platform yet.</span>
      )}
      {!countyOnly && sub && (
        <select defaultValue="" onChange={(e) => onChange?.(e.target.value)} aria-label="Ward">
          <option value="">Ward…</option>
          {sub.wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}
    </div>
  );
}
