'use client';
import { Search } from 'lucide-react';
import { SORTS } from '@/lib/utilities/sort';

export function FilterBar({ query, onQuery, sort, onSort, label = 'Filter' }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <label htmlFor="filter-input" className="sr-only">{label}</label>
        <input id="filter-input" className="field !rounded-full !py-2 !pl-9" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={label} />
      </div>
      {onSort && (
        <>
          <label htmlFor="sort-select" className="sr-only">Sort by</label>
          <select id="sort-select" className="field !w-auto !rounded-full !py-2" value={sort} onChange={(e) => onSort(e.target.value)}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>Sort: {l}</option>)}
          </select>
        </>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, id }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-elevated'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}
