/**
 * Error Modal Component
 * Displays user-friendly error messages with optional action buttons
 */

let currentModal = null;

/**
 * Show an error modal
 * @param {string} title - Error title
 * @param {string} message - Error message (user-friendly)
 * @param {object} action - Optional { label: string, callback: function }
 */
export function showError(title, message, action = null) {
  // Close existing modal if any
  if (currentModal) {
    closeErrorModal();
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'error-modal-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  const modal = document.createElement('div');
  modal.className = 'error-modal';
  modal.setAttribute('role', 'alertdialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'error-modal-title');
  modal.setAttribute('aria-describedby', 'error-modal-message');

  let actionButton = '';
  if (action) {
    const { label } = action;
    actionButton = `
      <button id="error-action-btn" class="btn btn-primary">
        ${escapeHtml(label)}
      </button>
    `;
  }

  modal.innerHTML = `
    <div class="error-modal-content">
      <div class="error-modal-header">
        <h2 id="error-modal-title" class="error-modal-title">⚠ ${escapeHtml(title)}</h2>
        <button class="error-modal-close" aria-label="Close error dialog">×</button>
      </div>
      <div id="error-modal-message" class="error-modal-message">
        ${escapeHtml(message)}
      </div>
      <div class="error-modal-actions">
        ${actionButton}
        <button id="error-close-btn" class="btn btn-secondary">
          Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  currentModal = { modal, backdrop };

  // Event listeners
  const closeBtn = modal.querySelector('.error-modal-close');
  const actionBtn = modal.querySelector('#error-action-btn');
  const doneBtn = modal.querySelector('#error-close-btn');
  const handleBackdropClick = (e) => {
    if (e.target === backdrop) {
      closeErrorModal();
    }
  };

  closeBtn.addEventListener('click', closeErrorModal);
  doneBtn.addEventListener('click', closeErrorModal);
  backdrop.addEventListener('click', handleBackdropClick);

  if (actionBtn && action) {
    actionBtn.addEventListener('click', () => {
      closeErrorModal();
      action.callback?.();
    });
  }

  // Focus modal title
  modal.querySelector('.error-modal-title').focus();

  // Keyboard support
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeErrorModal();
    }
  };
  modal.addEventListener('keydown', handleKeyDown);

  return modal;
}

/**
 * Show a confirmation dialog styled like the app's error modal.
 * Replaces native window.confirm() for consistency and to avoid blocking dialogs.
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {object} options - { confirmLabel, cancelLabel, danger }
 * @returns {Promise<boolean>} Resolves true if confirmed, false otherwise
 */
export function showConfirm(title, message, options = {}) {
  const {
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
  } = options;

  if (currentModal) {
    closeErrorModal();
  }

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'error-modal-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    const modal = document.createElement('div');
    modal.className = 'error-modal';
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'error-modal-title');
    modal.setAttribute('aria-describedby', 'error-modal-message');

    modal.innerHTML = `
      <div class="error-modal-content">
        <div class="error-modal-header">
          <h2 id="error-modal-title" class="error-modal-title" tabindex="-1">⚠ ${escapeHtml(title)}</h2>
        </div>
        <div id="error-modal-message" class="error-modal-message">
          ${escapeHtml(message)}
        </div>
        <div class="error-modal-actions">
          <button id="confirm-ok-btn" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">
            ${escapeHtml(confirmLabel)}
          </button>
          <button id="confirm-cancel-btn" class="btn btn-secondary">
            ${escapeHtml(cancelLabel)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    currentModal = { modal, backdrop };

    let settled = false;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      closeErrorModal();
      resolve(result);
    };

    modal.querySelector('#confirm-ok-btn').addEventListener('click', () => finish(true));
    modal.querySelector('#confirm-cancel-btn').addEventListener('click', () => finish(false));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        finish(false);
      }
    });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        finish(false);
      }
    });

    modal.querySelector('.error-modal-title').focus();
  });
}

/**
 * Close the current error modal
 */
function closeErrorModal() {
  if (!currentModal) {
    return;
  }

  const { modal, backdrop } = currentModal;

  modal.classList.add('error-modal-dismissing');
  backdrop.classList.add('error-modal-backdrop-dismissing');

  setTimeout(() => {
    if (modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
    if (backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }
    currentModal = null;
  }, 200);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export { closeErrorModal };
