/**
 * Missing Fields Modal
 * When the AI detects form fields that have no match in the user's saved
 * profile, this modal asks the user for those values on the spot. Answers are
 * returned to the caller, which saves them to the profile and places them on
 * the form. Leaving an input blank skips that field.
 */

/**
 * Ask the user to supply values for form fields the profile doesn't cover.
 * @param {Array<{label: string}>} missingFields - detected fields with no data
 * @returns {Promise<Object>} map of label -> value for the fields the user filled in
 */
export function askForMissingFields(missingFields) {
  // Ask once per unique label (the answer is applied to every occurrence)
  const uniqueLabels = [...new Set(missingFields.map(f => f.label.trim()).filter(Boolean))];
  if (uniqueLabels.length === 0) {
    return Promise.resolve({});
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'missing-fields-modal';

    const backdrop = document.createElement('div');
    backdrop.className = 'missing-fields-backdrop';

    const content = document.createElement('div');
    content.className = 'missing-fields-content';

    const title = document.createElement('h3');
    title.textContent = 'A few more details needed';
    content.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'missing-fields-subtitle';
    subtitle.textContent = 'This form asks for information not in your profile. '
      + 'Fill in what you can — it will be saved to My Info so you won’t be asked again. '
      + 'Leave blank to skip.';
    content.appendChild(subtitle);

    const list = document.createElement('div');
    list.className = 'missing-fields-list';
    const inputs = new Map();

    uniqueLabels.forEach(label => {
      const row = document.createElement('label');
      row.className = 'missing-field-row';

      const span = document.createElement('span');
      span.textContent = label;

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Leave blank to skip';

      row.append(span, input);
      list.appendChild(row);
      inputs.set(label, input);
    });
    content.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'missing-fields-actions';

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'btn btn-secondary';
    skipBtn.textContent = 'Skip All';

    const fillBtn = document.createElement('button');
    fillBtn.type = 'button';
    fillBtn.className = 'btn btn-primary';
    fillBtn.textContent = 'Add to Form';

    actions.append(skipBtn, fillBtn);
    content.appendChild(actions);

    overlay.append(backdrop, content);
    document.body.appendChild(overlay);

    function close(answers) {
      overlay.remove();
      resolve(answers);
    }

    skipBtn.addEventListener('click', () => close({}));
    backdrop.addEventListener('click', () => close({}));
    fillBtn.addEventListener('click', () => {
      const answers = {};
      inputs.forEach((input, label) => {
        const value = input.value.trim();
        if (value) {
          answers[label] = value;
        }
      });
      close(answers);
    });

    // Focus the first input so the user can start typing immediately
    const first = inputs.values().next().value;
    if (first) {
      setTimeout(() => first.focus(), 100);
    }
  });
}
