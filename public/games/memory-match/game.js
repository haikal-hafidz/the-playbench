// Memory Match Game with TPGP Platform Bridge
(function () {
  // Craft workbench themed item icons
  const SYMBOLS = ['🎲', '✂️', '📐', '✏️', '📌', '🔍'];
  let cards = [];
  let flippedCards = [];
  let matchedPairs = 0;
  let moves = 0;
  let bestMoves = null;
  let isLocked = false;

  const gridEl = document.getElementById('grid');
  const movesEl = document.getElementById('moves-count');
  const pairsEl = document.getElementById('pairs-count');
  const bestMovesEl = document.getElementById('best-moves');
  const statusEl = document.getElementById('status-banner');
  const restartBtn = document.getElementById('restart-btn');

  function sendToPlatform(type, payload) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          source: 'tpgp-game',
          gameId: 'memory-match',
          type: type,
          payload: payload || {},
        },
        '*'
      );
    }
  }

  window.addEventListener('message', function (event) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'PLAYBENCH_INIT' || data.type === 'PLAYBENCH_RESTORE_SAVE') {
      const state = data.payload && data.payload.saveState;
      if (state && typeof state.bestMoves === 'number') {
        bestMoves = state.bestMoves;
        bestMovesEl.textContent = bestMoves;
      }
    }
  });

  sendToPlatform('PLAYBENCH_READY', {
    ready: true,
    title: 'Memory Match',
    version: '1.0.0',
  });

  sendToPlatform('PLAYBENCH_REQUEST_SAVE', { slot: 'default' });

  function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  function initBoard() {
    gridEl.innerHTML = '';
    flippedCards = [];
    matchedPairs = 0;
    moves = 0;
    isLocked = false;
    movesEl.textContent = '0';
    pairsEl.textContent = '0 / ' + SYMBOLS.length;
    statusEl.className = 'status-banner';
    statusEl.textContent = 'Tap any card to uncover a token!';

    const deck = shuffle(SYMBOLS.concat(SYMBOLS));
    cards = deck.map(function (symbol, index) {
      const cardEl = document.createElement('div');
      cardEl.className = 'memory-card';
      cardEl.dataset.index = index;
      cardEl.dataset.symbol = symbol;
      cardEl.textContent = '🎴'; // Back pattern

      cardEl.addEventListener('click', function () {
        handleCardClick(cardEl, symbol);
      });

      gridEl.appendChild(cardEl);
      return cardEl;
    });
  }

  function handleCardClick(cardEl, symbol) {
    if (isLocked) return;
    if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;

    cardEl.classList.add('flipped');
    cardEl.textContent = symbol;
    flippedCards.push({ el: cardEl, symbol: symbol });

    if (flippedCards.length === 2) {
      moves++;
      movesEl.textContent = moves;
      isLocked = true;

      const card1 = flippedCards[0];
      const card2 = flippedCards[1];

      if (card1.symbol === card2.symbol) {
        // Matched!
        setTimeout(function () {
          card1.el.classList.add('matched');
          card2.el.classList.add('matched');
          flippedCards = [];
          matchedPairs++;
          pairsEl.textContent = matchedPairs + ' / ' + SYMBOLS.length;
          isLocked = false;

          if (matchedPairs === SYMBOLS.length) {
            handleWin();
          }
        }, 400);
      } else {
        // Not matched - flip back
        setTimeout(function () {
          card1.el.classList.remove('flipped');
          card1.el.textContent = '🎴';
          card2.el.classList.remove('flipped');
          card2.el.textContent = '🎴';
          flippedCards = [];
          isLocked = false;
        }, 800);
      }
    }
  }

  function handleWin() {
    statusEl.className = 'status-banner win';
    statusEl.textContent = `🏆 All pairs matched in ${moves} moves!`;

    if (bestMoves === null || moves < bestMoves) {
      bestMoves = moves;
      bestMovesEl.textContent = bestMoves;

      sendToPlatform('PLAYBENCH_SAVE_REQUEST', {
        slot: 'default',
        state: { bestMoves: bestMoves },
      });
    }

    sendToPlatform('PLAYBENCH_GAME_OVER', {
      score: moves,
      summary: `Cleared in ${moves} moves`,
    });
  }

  restartBtn.addEventListener('click', initBoard);

  initBoard();
})();
