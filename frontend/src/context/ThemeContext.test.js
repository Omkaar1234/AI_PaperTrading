import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ThemeProvider, useTheme } from './ThemeContext';

function TestConsumer() {
  const { theme, isDark } = useTheme();

  return (
    <div data-theme={theme} data-is-dark={isDark ? 'true' : 'false'}>
      <span className="theme-display">{theme}</span>
      <span className="dark-status">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
    </div>
  );
}

describe('ThemeContext and ThemeProvider', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  test('renders with light theme default', () => {
    const html = ReactDOMServer.renderToString(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(html).toContain('data-theme="light"');
    expect(html).toContain('data-is-dark="false"');
    expect(html).toContain('theme-display">light</span>');
    expect(html).toContain('Light Mode');
  });

  test('renders stored theme when provided in localStorage', () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('uprise_theme', 'dark');
    }

    const html = ReactDOMServer.renderToString(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    // Initial render reflects stored preference
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-is-dark="true"');
    expect(html).toContain('theme-display">dark</span>');
    expect(html).toContain('Dark Mode');
  });

  test('throws descriptive error if useTheme is accessed outside ThemeProvider', () => {
    // Suppress console.error during expected throw
    const originalError = console.error;
    console.error = () => {};

    expect(() => {
      ReactDOMServer.renderToString(<TestConsumer />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    console.error = originalError;
  });
});

