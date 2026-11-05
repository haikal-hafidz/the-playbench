// Number Guess Game with TPGP Platform Bridge
(function () {
  let targetNumber = generateTarget();
  let attempts = 0;
  let bestScore = null;
  let guesses = [];
  let isGameOver = false;
  let isInitialized = false;

  const attemptCountEl = document.getElementById('attempt-count');
  const bestScoreEl = document.getElementById('best-score');
  const feedbackEl = document.getElementById('feedback');
  const guessForm = document.getElementById('guess-form');
  const guessInput = document.getElementById('guess-input');
  const guessHistoryEl = document.getElementById('guess-history');
  const resetBtn = document.getElementById('reset-btn');

  function generateTarget() {
    return Math.floor(Math.random() * 100) + 1;
  }

  // TPGP Platform Bridge Communication
  function sendToPlatform(type, payload) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          source: 'tpgp-game',
          gameId: 'number-guess',
          type: type,
          payload: payload || {},
        },
        '*'
      );
    }
  }

  function applyRestoredState(saveState) {
    if (saveState && typeof saveState === 'object') {
      if (typeof saveState.bestScore === 'number' && Number.isFinite(saveState.bestScore)) {
        bestScore = saveState.bestScore;
        bestScoreEl.textContent = bestScore;
      }
    }
  }

  function finishInitialization(saveState) {
    if (isInitialized) return;
    applyRestoredState(saveState);
    isInitialized = true;

    // Signal game is loaded and ready
    sendToPlatform('PLAYBENCH_READY', {
      ready: true,
      title: 'Number Guess',
      version: '1.0.0',
    });
  }

  // Handle messages from Playbench Platform
  window.addEventListener('message', function (event) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.source !== 'playbench-host') return;

    if (data.type === 'PLAYBENCH_INIT') {
      const saveState = data.payload ? data.payload.saveState : null;
      finishInitialization(saveState);
    } else if (data.type === 'PLAYBENCH_RESTORE_SAVE') {
      const saveState = data.payload ? data.payload.saveState : null;
      applyRestoredState(saveState);
    } else if (data.type === 'PLAYBENCH_SAVE_RESULT') {
      if (!data.payload || !data.payload.success) {
        console.warn('Playbench save rejected:', data.payload ? data.payload.error : 'Unknown error');
      }
    }
  });

  // Signal bridge that game script has mounted and is awaiting init
  sendToPlatform('PLAYBENCH_MOUNTED', {
    gameId: 'number-guess',
    version: '1.0.0',
  });

  // Fallback: If running standalone without host, initialize after 500ms
  setTimeout(function () {
    if (!isInitialized) {
      finishInitialization(null);
    }
  }, 500);

  function updateHistoryView() {
    if (guesses.length === 0) {
      guessHistoryEl.innerHTML = '<span class="empty-history">No guesses yet</span>';
      return;
    }

    guessHistoryEl.innerHTML = '';
    guesses.forEach(function (g) {
      const chip = document.createElement('span');
      chip.className = 'guess-chip ' + (g.dir === 'high' ? 'high' : 'low');
      chip.textContent = g.val + (g.dir === 'high' ? ' ↓' : ' ↑');
      guessHistoryEl.appendChild(chip);
    });
  }

  guessForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (isGameOver) return;

    const val = parseInt(guessInput.value, 10);
    if (isNaN(val) || val < 1 || val > 100) {
      feedbackEl.className = 'feedback-area';
      feedbackEl.textContent = 'Please enter a number between 1 and 100.';
      return;
    }

    attempts++;
    attemptCountEl.textContent = attempts;
    guessInput.value = '';
    guessInput.focus();

    if (val === targetNumber) {
      isGameOver = true;
      feedbackEl.className = 'feedback-area win';
      feedbackEl.textContent = `🎉 Correct! The number was ${targetNumber} in ${attempts} attempts!`;

      // Update best record if better
      if (bestScore === null || attempts < bestScore) {
        bestScore = attempts;
        bestScoreEl.textContent = bestScore;

        // Save via platform bridge with schemaVersion
        sendToPlatform('PLAYBENCH_SAVE_REQUEST', {
          slot: 'default',
          schemaVersion: '1.0.0',
          state: { bestScore: bestScore },
        });
      }

      // Notify platform of game over
      sendToPlatform('PLAYBENCH_GAME_OVER', {
        score: attempts,
        summary: `Solved in ${attempts} attempts`,
      });
    } else if (val > targetNumber) {
      feedbackEl.className = 'feedback-area too-high';
      feedbackEl.textContent = `Too high! Aim lower than ${val}.`;
      guesses.push({ val: val, dir: 'high' });
      updateHistoryView();
    } else {
      feedbackEl.className = 'feedback-area too-low';
      feedbackEl.textContent = `Too low! Aim higher than ${val}.`;
      guesses.push({ val: val, dir: 'low' });
      updateHistoryView();
    }
  });

  resetBtn.addEventListener('click', function () {
    targetNumber = generateTarget();
    attempts = 0;
    guesses = [];
    isGameOver = false;
    attemptCountEl.textContent = '0';
    feedbackEl.className = 'feedback-area';
    feedbackEl.textContent = 'Enter a guess to begin!';
    updateHistoryView();
    guessInput.value = '';
    guessInput.focus();
  });
})();
