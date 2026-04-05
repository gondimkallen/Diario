const EMOJIS = [
  '&#x2764;&#xFE0F;', '&#x1F60D;', '&#x1F970;', '&#x1F618;', '&#x1F60E;',
  '&#x1F973;', '&#x1F389;', '&#x2728;', '&#x1F31F;', '&#x1F308;',
  '&#x1F33B;', '&#x1F33A;', '&#x1F337;', '&#x1F338;', '&#x1F331;',
  '&#x2615;', '&#x1F382;', '&#x1F36B;', '&#x1F3B5;', '&#x1F4D6;',
  '&#x1F4AA;', '&#x1F917;', '&#x1F60C;', '&#x1F634;', '&#x1F4AD;'
];

const MOOD_EMOJIS = { 5: '\u{1F929}', 4: '\u{1F60A}', 3: '\u{1F610}', 2: '\u{1F614}', 1: '\u{1F622}' };
const MOOD_LABELS = { 5: 'Ótimo', 4: 'Bom', 3: 'Normal', 2: 'Ruim', 1: 'Péssimo' };
const MOOD_COLORS = { 5: '#5CB85C', 4: '#8BC34A', 3: '#FFB74D', 2: '#FF8A65', 1: '#E57373' };

let notes = JSON.parse(localStorage.getItem('diary_notes') || '[]');
let currentView = 'all';
let editingNoteId = null;
let editorPinned = false;
let editorFavorited = false;
let selectedMood = null;
let currentPin = '';
let deleteTargetId = null;

// ==================== INIT ====================
function init() {
  if (!localStorage.getItem('diary_password')) {
    openPasswordSetup();
  }
  renderEmojiGrid();
}

// ==================== PASSWORD / LOCK ====================
function enterPin(digit) {
  if (currentPin.length >= 4) return;
  currentPin += digit;
  updatePinDisplay();

  if (currentPin.length === 4) {
    const savedPw = localStorage.getItem('diary_password');
    if (currentPin === savedPw) {
      unlock();
    } else {
      showPinError();
    }
  }
}

function updatePinDisplay() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('dot' + i);
    dot.classList.toggle('filled', i < currentPin.length);
    dot.innerHTML = i < currentPin.length ? '&bull;' : '';
  }
}

function clearPin() {
  currentPin = '';
  updatePinDisplay();
  document.getElementById('lockError').textContent = '';
  document.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('error'));
}

function deleteLastPin() {
  currentPin = currentPin.slice(0, -1);
  updatePinDisplay();
}

function showPinError() {
  document.getElementById('lockError').textContent = 'Senha incorreta. Tente novamente.';
  document.querySelectorAll('.pin-dot').forEach(d => d.classList.add('error'));
  setTimeout(() => {
    clearPin();
  }, 800);
}

function unlock() {
  window.location.href = "home.html";
}

function openPasswordSetup() {
  document.getElementById('pwSetupOverlay').classList.add('visible');
  document.getElementById('newPw').value = '';
  document.getElementById('confirmPw').value = '';
  document.getElementById('pwSetupError').textContent = '';
  document.getElementById('newPw').focus();
}

function saveNewPassword() {
  const newPw = document.getElementById('newPw').value;
  const confirmPw = document.getElementById('confirmPw').value;
  const errorEl = document.getElementById('pwSetupError');

  if (newPw.length !== 4 || !/^\d{4}$/.test(newPw)) {
    errorEl.textContent = 'O PIN deve conter exatamente 4 números.';
    return;
  }
  if (newPw !== confirmPw) {
    errorEl.textContent = 'Os PINs não coincidem.';
    return;
  }

  localStorage.setItem('diary_password', newPw);
  document.getElementById('pwSetupOverlay').classList.remove('visible');
  showToast('Senha salva com sucesso!');
  clearPin();
}

// ==================== NAVIGATION ====================
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${view}"]`).classList.add('active');

  const titles = {
    all: 'Todas as Notas',
    favorites: 'Favoritas',
    pinned: 'Fixadas',
    mood: 'Humor'
  };
  document.getElementById('viewTitle').textContent = titles[view];

  if (view === 'mood') {
    document.getElementById('notesView').style.display = 'none';
    document.getElementById('moodView').style.display = 'block';
    renderMoodChart();
  } else {
    document.getElementById('notesView').style.display = 'block';
    document.getElementById('moodView').style.display = 'none';
    renderNotes();
  }

  if (window.innerWidth <= 768) {
    toggleSidebar();
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarBackdrop').classList.toggle('open');
}

// ==================== NOTES RENDERING ====================
function getFilteredNotes() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  let filtered = [...notes];

  if (currentView === 'favorites') {
    filtered = filtered.filter(n => n.favorited);
  } else if (currentView === 'pinned') {
    filtered = filtered.filter(n => n.pinned);
  }

  if (search) {
    filtered = filtered.filter(n =>
      n.title.toLowerCase().includes(search) ||
      n.content.toLowerCase().includes(search)
    );
  }

  // Pinned notes first, then by date
  filtered.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return filtered;
}

function renderNotes() {
  const grid = document.getElementById('notesGrid');
  const empty = document.getElementById('emptyState');
  const filtered = getFilteredNotes();

  document.getElementById('totalBadge').textContent = notes.length;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = filtered.map(note => {
    const date = new Date(note.createdAt);
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    const moodEmoji = note.mood ? MOOD_EMOJIS[note.mood] : '';

    return `
      <div class="note-card ${note.pinned ? 'pinned' : ''}" onclick="openEditor('${note.id}')">
        <div class="note-card-header">
          <div class="note-mood">${moodEmoji}</div>
          <div class="note-actions">
            <button class="note-action-btn ${note.pinned ? 'active' : ''}" onclick="event.stopPropagation(); togglePin('${note.id}')" title="Fixar" aria-label="Fixar nota">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${note.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z"/></svg>
            </button>
            <button class="note-action-btn fav ${note.favorited ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${note.id}')" title="Favoritar" aria-label="Favoritar nota">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${note.favorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
          </div>
        </div>
        <div class="note-title">${escapeHtml(note.title || 'Sem título')}</div>
        <div class="note-preview">${escapeHtml(note.content || '')}</div>
        <div class="note-footer">
          <div class="note-date">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${dateStr}
          </div>
          ${note.emojis ? `<div class="note-tags">${note.emojis}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function togglePin(id) {
  const note = notes.find(n => n.id === id);
  if (note) {
    note.pinned = !note.pinned;
    saveNotes();
    renderNotes();
    showToast(note.pinned ? 'Nota fixada!' : 'Nota desfixada');
  }
}

function toggleFavorite(id) {
  const note = notes.find(n => n.id === id);
  if (note) {
    note.favorited = !note.favorited;
    saveNotes();
    renderNotes();
    showToast(note.favorited ? 'Adicionada aos favoritos!' : 'Removida dos favoritos');
  }
}

// ==================== EDITOR ====================
function openEditor(noteId) {
  editingNoteId = noteId || null;
  const overlay = document.getElementById('editorOverlay');

  if (noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    document.getElementById('editorTitle').value = note.title;
    document.getElementById('editorContent').value = note.content;
    selectedMood = note.mood;
    editorPinned = note.pinned || false;
    editorFavorited = note.favorited || false;
    document.getElementById('editorDateDisplay').textContent =
      new Date(note.createdAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    document.getElementById('editorDeleteBtn').style.display = 'inline-flex';
  } else {
    document.getElementById('editorTitle').value = '';
    document.getElementById('editorContent').value = '';
    selectedMood = null;
    editorPinned = false;
    editorFavorited = false;
    document.getElementById('editorDateDisplay').textContent =
      new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    document.getElementById('editorDeleteBtn').style.display = 'none';
  }

  updateMoodSelection();
  updateEditorButtons();
  overlay.classList.add('visible');
  document.getElementById('editorTitle').focus();
}

function closeEditor() {
  document.getElementById('editorOverlay').classList.remove('visible');
  editingNoteId = null;
}

function selectMood(el) {
  selectedMood = parseInt(el.dataset.mood);
  updateMoodSelection();
}

function updateMoodSelection() {
  document.querySelectorAll('.mood-option').forEach(opt => {
    opt.classList.toggle('selected', parseInt(opt.dataset.mood) === selectedMood);
  });
}

function toggleEditorPin() {
  editorPinned = !editorPinned;
  updateEditorButtons();
}

function toggleEditorFav() {
  editorFavorited = !editorFavorited;
  updateEditorButtons();
}

function updateEditorButtons() {
  document.getElementById('editorPinBtn').classList.toggle('active', editorPinned);
  document.getElementById('editorFavBtn').classList.toggle('active', editorFavorited);
}

function saveNote() {
  const title = document.getElementById('editorTitle').value.trim();
  const content = document.getElementById('editorContent').value.trim();

  if (!title && !content) {
    showToast('Escreva algo antes de salvar');
    return;
  }

  if (editingNoteId) {
    const note = notes.find(n => n.id === editingNoteId);
    if (note) {
      note.title = title;
      note.content = content;
      note.mood = selectedMood;
      note.pinned = editorPinned;
      note.favorited = editorFavorited;
      note.updatedAt = new Date().toISOString();
    }
  } else {
    notes.push({
      id: generateId(),
      title,
      content,
      mood: selectedMood,
      pinned: editorPinned,
      favorited: editorFavorited,
      emojis: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  saveNotes();
  closeEditor();
  renderNotes();
  showToast(editingNoteId ? 'Nota atualizada!' : 'Nota criada!');
}

function confirmDeleteNote() {
  deleteTargetId = editingNoteId;
  document.getElementById('confirmOverlay').classList.add('visible');
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('visible');
  deleteTargetId = null;
}

function deleteNote() {
  if (deleteTargetId) {
    notes = notes.filter(n => n.id !== deleteTargetId);
    saveNotes();
    closeConfirm();
    closeEditor();
    renderNotes();
    showToast('Nota excluída');
  }
}

// ==================== EMOJI GRID ====================
function renderEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  grid.innerHTML = EMOJIS.map(emoji =>
    `<button class="emoji-btn" onclick="insertEmoji(this)" type="button">${emoji}</button>`
  ).join('');
}

function insertEmoji(btn) {
  const textarea = document.getElementById('editorContent');
  const pos = textarea.selectionStart;
  const text = textarea.value;
  const emojiText = btn.textContent;
  textarea.value = text.slice(0, pos) + emojiText + text.slice(pos);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = pos + emojiText.length;
}

// ==================== MOOD CHART ====================
function renderMoodChart() {
  const canvas = document.getElementById('moodChart');
  const ctx = canvas.getContext('2d');
  const wrapper = canvas.parentElement;

  canvas.width = wrapper.clientWidth * 2;
  canvas.height = wrapper.clientHeight * 2;
  ctx.scale(2, 2);

  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;

  ctx.clearRect(0, 0, w, h);

  // Get last 30 entries with mood
  const moodEntries = notes
    .filter(n => n.mood)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-30);

  // Draw stats
  renderMoodStats();

  if (moodEntries.length < 2) {
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#B5ADA6';
    ctx.textAlign = 'center';
    ctx.fillText('Registre pelo menos 2 notas com humor para ver o gráfico', w / 2, h / 2);
    return;
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  // Grid lines
  ctx.strokeStyle = '#F0E6DE';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 5; i++) {
    const y = padding.top + chartH - ((i - 1) / 4) * chartH;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }

  // Y-axis labels
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = '#B5ADA6';
  ctx.textAlign = 'right';
  const yLabels = ['\u{1F622}', '\u{1F614}', '\u{1F610}', '\u{1F60A}', '\u{1F929}'];
  for (let i = 0; i < 5; i++) {
    const y = padding.top + chartH - (i / 4) * chartH;
    ctx.fillText(yLabels[i], padding.left - 8, y + 5);
  }

  // Plot points
  const points = moodEntries.map((entry, i) => ({
    x: padding.left + (i / (moodEntries.length - 1)) * chartW,
    y: padding.top + chartH - ((entry.mood - 1) / 4) * chartH,
    mood: entry.mood,
    date: entry.createdAt
  }));

  // Area fill
  ctx.beginPath();
  ctx.moveTo(points[0].x, padding.top + chartH);
  points.forEach((p, i) => {
    if (i === 0) {
      ctx.lineTo(p.x, p.y);
    } else {
      const cpx = (points[i - 1].x + p.x) / 2;
      ctx.bezierCurveTo(cpx, points[i - 1].y, cpx, p.y, p.x, p.y);
    }
  });
  ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
  gradient.addColorStop(0, 'rgba(232, 115, 90, 0.15)');
  gradient.addColorStop(1, 'rgba(232, 115, 90, 0.02)');
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) {
      ctx.moveTo(p.x, p.y);
    } else {
      const cpx = (points[i - 1].x + p.x) / 2;
      ctx.bezierCurveTo(cpx, points[i - 1].y, cpx, p.y, p.x, p.y);
    }
  });
  ctx.strokeStyle = '#E8735A';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Points
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = MOOD_COLORS[p.mood];
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // X-axis dates
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = '#B5ADA6';
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(points.length / 7));
  for (let i = 0; i < points.length; i += step) {
    const date = new Date(points[i].date);
    ctx.fillText(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), points[i].x, h - 8);
  }
}

function renderMoodStats() {
  const stats = document.getElementById('moodStats');
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  notes.forEach(n => { if (n.mood) counts[n.mood]++; });

  stats.innerHTML = Object.keys(counts).sort((a, b) => b - a).map(mood => `
    <div class="mood-stat-card">
      <div class="mood-stat-emoji">${MOOD_EMOJIS[mood]}</div>
      <div class="mood-stat-count">${counts[mood]}</div>
      <div class="mood-stat-label">${MOOD_LABELS[mood]}</div>
    </div>
  `).join('');
}

// ==================== UTILITIES ====================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function saveNotes() {
  localStorage.setItem('diary_notes', JSON.stringify(notes));
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, c => map[c]);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

// Handle window resize for chart
window.addEventListener('resize', () => {
  if (currentView === 'mood') renderMoodChart();
});

// Close modals on escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('confirmOverlay').classList.contains('visible')) {
      closeConfirm();
    } else if (document.getElementById('editorOverlay').classList.contains('visible')) {
      closeEditor();
    }
  }
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registrado:', registration.scope);
      })
      .catch(error => {
        console.log('SW falhou:', error);
      });
  });
}

// Init
init();
