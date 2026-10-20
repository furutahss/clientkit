import { describe, expect, it } from 'vitest';
import { tools } from './tools';
import { uuidV4 } from '@/lib/id-generator';

describe('UUID生成の統合', () => {
  it('独立ページを登録せずID生成のUUID形式を維持する', () => {
    expect(tools.some(t => t.id === 'uuid-generator')).toBe(false);
    expect(tools.some(t => t.id === 'id-generator')).toBe(true);
    expect(uuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
