import { describe, it, expect } from 'vitest';
import { decodeFit } from '../fit/decode.js';
import { encodeFit } from '../fit/encode.js';
import { Profile } from '@garmin/fitsdk';
import { buildFitWithDeveloperField } from './fixtures.js';

const RECORD = Profile.MesgNum.RECORD as number;

describe('developer (application-defined) fields', () => {
  it('captures field descriptions on decode', () => {
    const dec = decodeFit(buildFitWithDeveloperField());
    expect(Object.keys(dec.fieldDescriptions).length).toBeGreaterThan(0);
  });

  it('throws when re-encoding without the field descriptions (the old bug)', () => {
    const dec = decodeFit(buildFitWithDeveloperField());
    expect(() => encodeFit(dec.raw, [])).toThrow();
  });

  it('round-trips developer fields when descriptions are supplied', () => {
    const dec = decodeFit(buildFitWithDeveloperField());
    const out = encodeFit(dec.raw, [], dec.fieldDescriptions);
    const re = decodeFit(out);

    const record = re.raw.find((r) => r.mesgNum === RECORD);
    expect(record?.mesg.developerFields).toMatchObject({ 0: 5 });
  });
});
