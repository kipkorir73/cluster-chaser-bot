import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('App', () => {
  it('renders the Deriv Volatility Monitor title', () => {
    render(<App />);

    // Assert that the "Deriv Volatility Monitor" title is in the document
    expect(screen.getByText(/🎯 Deriv Volatility Monitor/i)).toBeInTheDocument();
  });
});