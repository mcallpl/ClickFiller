/**
 * Unit tests for the missing-fields modal — the prompt shown when the AI
 * detects form fields that have no match in the user's saved profile.
 */

import { askForMissingFields } from '../../src/components/missing-fields-modal.js';

describe('askForMissingFields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves immediately with no answers when there are no labeled fields', async () => {
    const answers = await askForMissingFields([{ label: '' }, { label: '   ' }]);
    expect(answers).toEqual({});
    expect(document.getElementById('missing-fields-modal')).toBeNull();
  });

  it('shows one input per unique label', () => {
    askForMissingFields([
      { label: 'Occupation' },
      { label: 'Blood Type' },
      { label: 'Occupation' }, // duplicate — asked once
    ]);

    const modal = document.getElementById('missing-fields-modal');
    expect(modal).not.toBeNull();
    expect(modal.querySelectorAll('.missing-field-row').length).toBe(2);
  });

  it('resolves with typed values and removes the modal on "Add to Form"', async () => {
    const promise = askForMissingFields([{ label: 'Occupation' }, { label: 'Blood Type' }]);

    const modal = document.getElementById('missing-fields-modal');
    const inputs = modal.querySelectorAll('.missing-field-row input');
    inputs[0].value = 'Engineer';
    // second input left blank -> skipped

    const buttons = modal.querySelectorAll('button');
    const fillBtn = [...buttons].find(b => b.textContent === 'Add to Form');
    fillBtn.click();

    const answers = await promise;
    expect(answers).toEqual({ Occupation: 'Engineer' });
    expect(document.getElementById('missing-fields-modal')).toBeNull();
  });

  it('resolves with no answers on "Skip All"', async () => {
    const promise = askForMissingFields([{ label: 'Occupation' }]);

    const modal = document.getElementById('missing-fields-modal');
    const skipBtn = [...modal.querySelectorAll('button')].find(b => b.textContent === 'Skip All');
    skipBtn.click();

    const answers = await promise;
    expect(answers).toEqual({});
    expect(document.getElementById('missing-fields-modal')).toBeNull();
  });

  it('resolves with no answers when the backdrop is tapped', async () => {
    const promise = askForMissingFields([{ label: 'Occupation' }]);

    document.querySelector('.missing-fields-backdrop').click();

    const answers = await promise;
    expect(answers).toEqual({});
  });

  it('trims whitespace-only answers', async () => {
    const promise = askForMissingFields([{ label: 'Occupation' }]);

    const modal = document.getElementById('missing-fields-modal');
    modal.querySelector('.missing-field-row input').value = '   ';
    [...modal.querySelectorAll('button')].find(b => b.textContent === 'Add to Form').click();

    const answers = await promise;
    expect(answers).toEqual({});
  });
});
