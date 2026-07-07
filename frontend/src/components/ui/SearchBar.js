import React from 'react';
import Input from './Input';

function SearchBar({ value, onChange, onSubmit, statusText, placeholder, ...props }) {
  return (
    <form className="ui-search-bar" onSubmit={onSubmit} role="search" {...props}>
      <span className="ui-search-icon" aria-hidden="true">⌕</span>
      <Input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label="Global symbol search"
      />
      {statusText ? <span className="ui-search-status">{statusText}</span> : <kbd>/</kbd>}
    </form>
  );
}

export default SearchBar;
