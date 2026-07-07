import React from 'react';
import { CAP_FILTERS, CHANGE_FILTERS, SECTORS, SORT_OPTIONS } from './marketUtils';

function Segment({ label, value, options, onChange }) {
  return (
    <label className="markets-filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value || option} value={option.value || option}>{option.label || option}</option>)}
      </select>
    </label>
  );
}

function SectorFilter({ filters, onFiltersChange }) {
  const setFilter = (key, value) => onFiltersChange({ ...filters, [key]: value });

  return (
    <section className="markets-filter-bar">
      <Segment label="Market cap" value={filters.cap} options={CAP_FILTERS} onChange={(value) => setFilter('cap', value)} />
      <Segment label="Sector" value={filters.sector} options={['All Sectors', ...SECTORS]} onChange={(value) => setFilter('sector', value)} />
      <Segment label="Price change" value={filters.change} options={CHANGE_FILTERS} onChange={(value) => setFilter('change', value)} />
      <Segment label="Sort" value={filters.sort} options={SORT_OPTIONS} onChange={(value) => setFilter('sort', value)} />
    </section>
  );
}

export default SectorFilter;
