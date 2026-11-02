import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import stimuliConfig from '../../config/stimuli.json';
import { parseAtlas } from '../lab/atlas';
import { decodeState } from '../lab/labState';
import { LESSONS, type Text } from './lessons';

const LANGS = ['en', 'ru', 'kk'] as const;
const PAGES = ['/', '/compress', '/scale', '/compare', '/experiments'];
const filled = (t: Text) => LANGS.every((l) => t[l].trim().length > 0);

describe('lessons', () => {
  it('has 5–7 lessons, each with steps, a quiz and sources, in all three languages', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(5);
    expect(LESSONS.length).toBeLessThanOrEqual(7);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      expect(filled(l.title) && filled(l.summary), l.id).toBe(true);
      expect(l.steps.length, l.id).toBeGreaterThan(0);
      for (const s of l.steps) expect(filled(s.text), l.id).toBe(true);
      expect(l.quiz.length, l.id).toBeGreaterThan(0);
      for (const q of l.quiz) {
        expect(filled(q.q) && filled(q.why) && q.options.every(filled), l.id).toBe(true);
        expect(q.answer >= 0 && q.answer < q.options.length, l.id).toBe(true);
      }
      expect(l.sources.length, l.id).toBeGreaterThan(0);
      for (const s of l.sources) expect(s.doi ?? s.file, `${l.id}: ${s.cite}`).toBeTruthy();
    }
  });

  it('every demo link opens a real page with known stimuli, cell types and regions', () => {
    const dir = resolve(__dirname, '../../public/data');
    const meta = JSON.parse(readFileSync(resolve(dir, 'meta.json'), 'utf8')) as { neuron_count: number; neuropils: string[] };
    const { file } = JSON.parse(readFileSync(resolve(dir, 'neurons.json'), 'utf8')) as { file: string };
    const raw = gunzipSync(readFileSync(resolve(dir, file)));
    const atlas = parseAtlas(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer, meta.neuron_count);
    const known = new Set(stimuliConfig.stimuli.map((s) => s.id));
    for (const l of LESSONS) {
      for (const s of l.steps) {
        if (!s.demo) continue;
        const [path, query = ''] = s.demo.split('?');
        expect(PAGES, s.demo).toContain(path);
        const state = decodeState(query, known);
        const p = new URLSearchParams(query);
        expect(Object.keys(state.stimuli).length, s.demo).toBe(p.get('s')?.split(',').length ?? 0);
        for (const o of state.opto) expect(atlas.types, s.demo).toContain(o.type);
        for (const x of state.lesions) if ('neuropil' in x) expect(meta.neuropils, s.demo).toContain(x.neuropil);
      }
    }
  });
});
