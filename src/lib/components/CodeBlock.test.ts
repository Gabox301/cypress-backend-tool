import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import CodeBlock from './CodeBlock.svelte';

// ---------------------------------------------------------------------------
// 4.3 — JSON colorization
// ---------------------------------------------------------------------------
describe('CodeBlock — JSON colorization', () => {
  it('renders JSON keys with json-key class', () => {
    render(CodeBlock, { props: { data: { name: 'Alice', age: 30 }, format: 'json' } });
    const keySpan = document.querySelector('.json-key');
    expect(keySpan).not.toBeNull();
    // The key text should appear somewhere in the document
    expect(screen.getByText(/"name"/)).toBeInTheDocument();
  });

  it('renders JSON string values with json-string class', () => {
    render(CodeBlock, { props: { data: { city: 'NYC' }, format: 'json' } });
    const stringSpan = document.querySelector('.json-string');
    expect(stringSpan).not.toBeNull();
  });

  it('renders JSON number values with json-number class', () => {
    render(CodeBlock, { props: { data: { count: 42 }, format: 'json' } });
    const numberSpan = document.querySelector('.json-number');
    expect(numberSpan).not.toBeNull();
  });

  it('renders JSON boolean values with json-bool class', () => {
    render(CodeBlock, { props: { data: { active: true, disabled: false }, format: 'json' } });
    const boolSpan = document.querySelector('.json-bool');
    expect(boolSpan).not.toBeNull();
  });

  it('renders JSON null values with json-null class', () => {
    render(CodeBlock, { props: { data: { deleted: null }, format: 'json' } });
    const nullSpan = document.querySelector('.json-null');
    expect(nullSpan).not.toBeNull();
  });

  it('displays plain string data as-is', () => {
    render(CodeBlock, { props: { data: 'Hello, World!', format: 'text' } });
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });

  it('renders nothing when data is null', () => {
    const { container } = render(CodeBlock, { props: { data: null, format: 'json' } });
    // The code-block container should exist but be empty (no code-body rendered)
    const block = container.querySelector('[data-testid="code-block"]');
    expect(block).not.toBeNull();
    const codeBody = block!.querySelector('.code-body');
    expect(codeBody).toBeNull();
  });

  it('renders multiline JSON with correct line numbers', () => {
    render(CodeBlock, { props: { data: { a: 1, b: 2 }, format: 'json' } });
    const lineNums = document.querySelectorAll('.line-num');
    expect(lineNums.length).toBeGreaterThanOrEqual(4);
  });

  it('handles circular reference by falling back to String()', () => {
    const obj: Record<string, unknown> = { name: 'test' };
    (obj as any).self = obj;
    render(CodeBlock, { props: { data: obj, format: 'json' } });
    // Should render without throwing — catch block converts to String(obj)
    const codeBlock = document.querySelector('[data-testid="code-block"]');
    expect(codeBlock).not.toBeNull();
  });

  it('copies formatted data to clipboard on button click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(CodeBlock, { props: { data: { key: 'value' }, format: 'json' } });
    const copyBtn = screen.getByText('copy');
    await fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('{\n  "key": "value"\n}');
  });
});
