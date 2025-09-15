/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('App', () => {
  it('renders the App component', () => {
    render(<App />);
    
    // Use a regular expression to find the text, making the test more flexible
    expect(screen.getByText(/Vite \+ React/i)).toBeInTheDocument();
  });
});
