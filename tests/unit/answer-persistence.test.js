/**
 * Regression test for the reported bug: values entered in the "missing details"
 * modal (shoe size, weight, etc.) were not persisting, so the app re-asked for
 * them on every visit.
 *
 * Root cause: the AI's form labels (e.g. "WEIGHT (lb)") contained characters
 * the custom-field-label validator rejected, which failed the ENTIRE profile
 * save — silently discarding every answer, including the valid ones.
 *
 * This exercises the real StorageManager save/load path.
 */

import { StorageManager } from '../../src/storage-manager.js';
import { setupLocalStorage } from '../helpers/test-utils.js';

describe('missing-field answers persist to the profile', () => {
  beforeEach(() => {
    setupLocalStorage();
  });

  it('saves custom fields whose labels came from AI form labels', () => {
    // Labels as they arrive from the modal, already normalized by capture.js
    // (parentheticals stripped). These must save AND survive a reload.
    const profile = {
      firstName: 'Chip',
      _custom: [
        { label: 'Shoe Size', value: '10.5' },
        { label: 'Weight', value: '185' },
        { label: 'Blood Type', value: 'O+' },
      ],
      'Shoe Size': '10.5',
      Weight: '185',
      'Blood Type': 'O+',
    };

    const result = StorageManager.saveProfile(profile);
    expect(result.success).toBe(true);

    const reloaded = StorageManager.loadProfile();
    const byLabel = Object.fromEntries(reloaded._custom.map((f) => [f.label, f.value]));
    expect(byLabel['Shoe Size']).toBe('10.5');
    expect(byLabel.Weight).toBe('185');
    expect(byLabel['Blood Type']).toBe('O+');
  });

  it('previously-failing raw labels with punctuation now save', () => {
    // Even if a raw label slips through un-normalized, the widened validator
    // must not reject it and nuke the save.
    const result = StorageManager.saveProfile({
      _custom: [{ label: 'Weight (lb)', value: '185' }],
      'Weight (lb)': '185',
    });
    expect(result.success).toBe(true);
    expect(StorageManager.loadProfile()._custom[0].value).toBe('185');
  });
});
