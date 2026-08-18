(() => {
  'use strict';

  const STORAGE_KEY = 'luck-lab-lotto-v1';
  const MAX_NUMBER = 45;
  const TICKET_PRICE = 1000;
  const PRIZES = { 1: 2000000000, 2: 50000000, 3: 1500000, 4: 50000, 5: 5000 };
  const RANK_LABELS = { 1: '1등 · 6개 일치', 2: '2등 · 5개 + 보너스', 3: '3등 · 5개 일치', 4: '4등 · 4개 일치', 5: '5등 · 3개 일치' };
  const initialState = () => ({ selected: [], totalWeeks: 0, totalTickets: 0, totalSpent: 0, totalWon: 0, ranks: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, history: [] });
  let state = loadState();

  const $ = (id) => document.getElementById(id);
  const picker = $('number-picker');
  const selectionCount = $('selection-count');
  const runButton = $('run-button');
  const validationMessage = $('validation-message');

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !Array.isArray(saved.selected) || !saved.ranks) return initialState();
      return { ...initialState(), ...saved, ranks: { ...initialState().ranks, ...saved.ranks }, history: Array.isArray(saved.history) ? saved.history.slice(0, 20) : [] };
    } catch { return initialState(); }
  }
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function numberClass(number) { return `ball-${Math.min(5, Math.floor((number - 1) / 10) + 1)}`; }
  function formatMoney(value) { return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value); }
  function randomNumbers(count, excluded = []) {
    const pool = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1).filter((number) => !excluded.includes(number));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, count).sort((a, b) => a - b);
  }
  function rankTicket(ticket, winning, bonus) {
    const matched = ticket.filter((number) => winning.includes(number)).length;
    if (matched === 6) return 1;
    if (matched === 5 && ticket.includes(bonus)) return 2;
    if (matched === 5) return 3;
    if (matched === 4) return 4;
    if (matched === 3) return 5;
    return null;
  }
  function renderPicker() {
    picker.replaceChildren();
    for (let number = 1; number <= MAX_NUMBER; number++) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = `number-button ${state.selected.includes(number) ? 'selected' : ''}`;
      button.textContent = number; button.setAttribute('aria-pressed', String(state.selected.includes(number)));
      button.addEventListener('click', () => {
        if (state.selected.includes(number)) state.selected = state.selected.filter((item) => item !== number);
        else if (state.selected.length < 6) state.selected = [...state.selected, number].sort((a, b) => a - b);
        updateSelectionUI(); persist();
      });
      picker.append(button);
    }
    updateSelectionUI();
  }
  function updateSelectionUI() {
    const valid = state.selected.length === 6;
    selectionCount.textContent = `${state.selected.length} / 6`;
    runButton.disabled = !valid;
    validationMessage.textContent = valid ? `선택 번호: ${state.selected.join(' · ')} — 준비됐어요.` : '번호 6개를 선택하면 시작할 수 있어요.';
    picker.querySelectorAll('.number-button').forEach((button) => {
      const selected = state.selected.includes(Number(button.textContent));
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
  }
  function renderSummary() {
    $('total-weeks').textContent = state.totalWeeks.toLocaleString('ko-KR');
    $('total-tickets').textContent = state.totalTickets.toLocaleString('ko-KR');
    $('total-spent').textContent = formatMoney(state.totalSpent);
    $('total-won').textContent = formatMoney(state.totalWon);
    const net = state.totalWon - state.totalSpent;
    const netElement = $('net-result'); netElement.textContent = `${net > 0 ? '+' : ''}${formatMoney(net)}`;
    netElement.parentElement.classList.toggle('positive', net > 0); netElement.parentElement.classList.toggle('negative', net < 0);
    const rankGrid = $('rank-grid'); rankGrid.replaceChildren();
    for (let rank = 1; rank <= 5; rank++) {
      const item = document.createElement('article'); item.className = 'rank-card';
      item.innerHTML = `<small>${rank}등</small><span>${RANK_LABELS[rank].replace(/^\d등 · /, '')}</span><strong>${state.ranks[rank].toLocaleString('ko-KR')}<small>회</small></strong>`;
      rankGrid.append(item);
    }
  }
  function makeBall(number) { const ball = document.createElement('span'); ball.className = `ball ${numberClass(number)}`; ball.textContent = number; return ball; }
  function renderHistory() {
    const list = $('history-list'); list.replaceChildren();
    if (!state.history.length) { list.innerHTML = '<div class="empty-state">아직 기록이 없어요. 번호를 고르고 첫 추첨을 시작해 보세요.</div>'; return; }
    const template = $('history-template');
    state.history.forEach((entry) => {
      const node = template.content.cloneNode(true);
      node.querySelector('.draw-week').textContent = `${entry.week}주차`;
      node.querySelector('.draw-date').textContent = entry.date;
      const balls = node.querySelector('.winning-balls'); entry.winning.forEach((number) => balls.append(makeBall(number)));
      node.querySelector('.bonus-ball').append(makeBall(entry.bonus));
      const wins = Object.entries(entry.ranks).filter(([, count]) => count).map(([rank, count]) => `${rank}등 ${count}회`);
      node.querySelector('.draw-result').innerHTML = wins.length ? `<b>${wins.join(' · ')}</b><br>당첨금 ${formatMoney(entry.won)}` : '이번 주 당첨 없음';
      list.append(node);
    });
  }
  function simulate(weeks) {
    const newHistory = [];
    for (let offset = 1; offset <= weeks; offset++) {
      const winning = randomNumbers(6); const bonus = randomNumbers(1, winning)[0];
      const tickets = [state.selected.slice(), ...Array.from({ length: 99 }, () => randomNumbers(6))];
      const weeklyRanks = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; let weeklyWon = 0;
      tickets.forEach((ticket) => { const rank = rankTicket(ticket, winning, bonus); if (rank) { weeklyRanks[rank]++; weeklyWon += PRIZES[rank]; state.ranks[rank]++; } });
      state.totalWeeks++; state.totalTickets += 100; state.totalSpent += 100 * TICKET_PRICE; state.totalWon += weeklyWon;
      newHistory.push({ week: state.totalWeeks, date: new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }), winning, bonus, ranks: weeklyRanks, won: weeklyWon });
    }
    state.history = [...newHistory.reverse(), ...state.history].slice(0, 20);
    persist(); renderSummary(); renderHistory();
  }
  $('randomize-button').addEventListener('click', () => { state.selected = randomNumbers(6); renderPicker(); persist(); });
  $('clear-selection-button').addEventListener('click', () => { state.selected = []; renderPicker(); persist(); });
  $('run-button').addEventListener('click', () => {
    const weeks = Number($('week-input').value);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 10000) { validationMessage.textContent = '1부터 10,000 사이의 정수 주 수를 입력해 주세요.'; return; }
    simulate(weeks); validationMessage.textContent = `${weeks.toLocaleString('ko-KR')}주 시뮬레이션을 완료했어요.`;
  });
  $('reset-button').addEventListener('click', () => {
    if (!window.confirm('선택 번호와 모든 누적 기록을 초기화할까요?')) return;
    state = initialState(); persist(); renderPicker(); renderSummary(); renderHistory();
  });
  renderPicker(); renderSummary(); renderHistory();
})();
