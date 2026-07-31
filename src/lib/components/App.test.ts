import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import App from './App.svelte';

describe('App component — container shell', () => {
  it('renders the scroll-area', () => {
    const { container } = render(App);
    expect(container.querySelector('#cabt-scroll-area')).not.toBeNull();
  });

  it('renders the bottom anchor inside the scroll-area', () => {
    const { container } = render(App);
    const scrollArea = container.querySelector('#cabt-scroll-area');
    expect(scrollArea?.querySelector('.bottom-anchor')).not.toBeNull();
  });

  it('does not render any cabt-entry-* elements (those come from mountEntry)', () => {
    const { container } = render(App);
    expect(container.querySelector('[id^="cabt-entry"]')).toBeNull();
  });
});
