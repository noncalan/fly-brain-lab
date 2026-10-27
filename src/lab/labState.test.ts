import { describe, expect, it } from 'vitest';
import { decodeState, encodeState, type LabState } from './labState';

const KNOWN = new Set(['sugar', 'bitter']);

describe('lab state in the URL', () => {
  it('round-trips stimuli, one-sided optogenetics and lesions', () => {
    const s: LabState = {
      stimuli: { sugar: 150, bitter: 100 },
      opto: [{ type: 'DNp09', side: 'right', rateHz: 150 }, { type: 'MDN', side: 'both', rateHz: 80 }],
      lesions: [{ neuropil: 'GNG' }, { type: 'DNp01' }],
    };
    expect(decodeState(encodeState(s), KNOWN)).toEqual(s);
  });

  it('drops unknown stimuli, bad rates and unsafe names', () => {
    const s = decodeState('s=sugar:abc,evil:100,bitter:9999,sugar:50&o=<script>:100,DNp09.l:0,MN9:20&x=../x,t.MN9', KNOWN);
    expect(s.stimuli).toEqual({ sugar: 50 });
    expect(s.opto).toEqual([{ type: 'MN9', side: 'both', rateHz: 20 }]);
    expect(s.lesions).toEqual([{ type: 'MN9' }]);
  });

  it('empty query gives an empty experiment', () => {
    expect(decodeState('', KNOWN)).toEqual({ stimuli: {}, opto: [], lesions: [] });
  });
});
