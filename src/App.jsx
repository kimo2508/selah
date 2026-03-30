import { useState, useEffect, useRef } from 'react';

// ── Transpose helpers ────────────────────────────────────────────────────────
const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ENHARMONIC = { 'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#' };
function normalizeNote(n) { return ENHARMONIC[n] || n; }
function transposeNote(note, st) {
  const clean = note.replace(/m|maj|min|dim|aug|sus|add|\d/g, '');
  const suffix = note.slice(clean.length);
  const idx = CHROMATIC.indexOf(normalizeNote(clean));
  if (idx === -1) return note;
  return CHROMATIC[((idx + st) % 12 + 12) % 12] + suffix;
}
function transposeChord(chord, st) {
  if (!st) return chord;
  if (chord.includes('/')) {
    const [t, b] = chord.split('/');
    return transposeChord(t, st) + '/' + transposeNote(b, st);
  }
  const m = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return chord;
  return transposeNote(m[1], st) + m[2];
}
function transposeKey(k, st) {
  if (!st) return k;
  const minor = /minor|min$/i.test(k);
  const r = k.match(/^([A-G][#b]?)/);
  if (!r) return k;
  return transposeNote(r[1], st) + (minor ? ' minor' : '');
}

// ── Nashville Number System ──────────────────────────────────────────────────
function romanToNashville(func) {
  if (!func) return '';
  const map = {
    'I':'1','II':'2','III':'3','IV':'4','V':'5','VI':'6','VII':'7',
    'i':'1','ii':'2','iii':'3','iv':'4','v':'5','vi':'6','vii':'7',
    'bII':'b2','bIII':'b3','bVII':'b7','bii':'b2','biii':'b3','bvii':'b7',
    '#IV':'#4','#iv':'#4',
  };
  const quality = func.match(/(maj|min|dim|aug|sus|add|\d+|m(?!aj))+$/i)?.[0] || '';
  const numeral = func.slice(0, func.length - quality.length);
  const isLower = numeral === numeral.toLowerCase() && numeral !== numeral.toUpperCase();
  const num = map[numeral] || map[numeral.toUpperCase()] || numeral;
  const minSuffix = isLower && !quality.includes('m') ? 'm' : '';
  return num + minSuffix + quality.replace(/^m(?!aj|in)/i, '');
}

// ── Quick suggests ───────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { title: 'Way Maker', artist: 'Sinach' },
  { title: 'Goodness of God', artist: 'Bethel Music' },
  { title: 'Graves Into Gardens', artist: 'Elevation Worship' },
  { title: 'What A Beautiful Name', artist: 'Hillsong Worship' },
  { title: 'Build My Life', artist: 'Housefires' },
  { title: 'King of Kings', artist: 'Hillsong Worship' },
  { title: 'Battle Belongs', artist: 'Phil Wickham' },
  { title: 'Reckless Love', artist: 'Cory Asbury' },
];

// ── AI chart fetch ───────────────────────────────────────────────────────────
async function fetchChart(title, artist) {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'You are an expert worship bass player. Return ONLY valid JSON. No markdown, no backticks, no explanation.',
      messages: [{
        role: 'user',
        content: `Bass chart for: "${title}" by "${artist || 'unknown'}"
Return ONLY this JSON:
{
  "title": "song title",
  "artist": "artist name",
  "key": "key e.g. G or Ab minor",
  "bpm": 72,
  "timeSignature": "4/4",
  "sections": [
    {"name": "Intro", "chords": [{"chord": "G", "beats": 4, "function": "I"}]},
    {"name": "Verse", "chords": [{"chord": "G", "beats": 4, "function": "I"},{"chord": "D", "beats": 4, "function": "V"},{"chord": "Em", "beats": 4, "function": "vi"},{"chord": "C", "beats": 4, "function": "IV"}]},
    {"name": "Pre-Chorus", "chords": [{"chord": "Em", "beats": 4, "function": "vi"},{"chord": "C", "beats": 4, "function": "IV"}]},
    {"name": "Chorus", "chords": [{"chord": "G", "beats": 4, "function": "I"},{"chord": "D", "beats": 2, "function": "V"},{"chord": "Em", "beats": 2, "function": "vi"},{"chord": "C", "beats": 4, "function": "IV"}]},
    {"name": "Bridge", "chords": [{"chord": "C", "beats": 4, "function": "IV"},{"chord": "G", "beats": 4, "function": "I"}]}
  ],
  "bassTab": {
    "Verse": {"G": "|-3--3-3--3--|","D": "|------------|","A": "|--0--0-0----|","E": "|------------|","description": "Root notes, quarter note feel"},
    "Chorus": {"G": "|-3--3-3--3--|","D": "|-0--0-0--0--|","A": "|------------|","E": "|------------|","description": "Drive with eighth notes"}
  },
  "bassNotes": {
    "feel": "groove description",
    "rootNotes": "fretboard guidance",
    "dynamics": "dynamics guidance",
    "tips": ["tip 1", "tip 2", "tip 3"]
  }
}`
      }]
    })
  });
  const data = await resp.json();
  const text = data.content?.find(b => b.type === 'text')?.text || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ── Planning Center API calls ────────────────────────────────────────────────
async function pcoGet(action, params = {}) {
  const query = new URLSearchParams({ action, ...params }).toString();
  const resp = await fetch(`/api/planning-center?${query}`);
  if (!resp.ok) throw new Error(`PCO error ${resp.status}`);
  return resp.json();
}

// ── Format date nicely ───────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// ── CSS ──────────────────────────────────────────────────────────────────────
const styles = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0f0f0f; --bg2: #1a1a1a; --bg3: #242424; --bg4: #2e2e2e;
  --border: rgba(255,255,255,0.08); --border2: rgba(255,255,255,0.15);
  --text: #f0ede8; --text2: #8a8680; --text3: #555250;
  --accent: #e8c170; --accent-bg: rgba(232,193,112,0.12);
  --blue: #5b9cf6; --blue-bg: rgba(91,156,246,0.12);
  --green: #6bcb8b; --green-bg: rgba(107,203,139,0.12);
  --purple: #b59cf6; --purple-bg: rgba(181,156,246,0.12);
  --red: #f07070;
  --radius: 10px; --radius-sm: 6px;
  --font: 'Sora', sans-serif; --mono: 'Space Mono', monospace;
}
html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); -webkit-font-smoothing: antialiased; }
.app { min-height: 100dvh; max-width: 640px; margin: 0 auto; padding: 0 0 90px; }

.nav-bar { position: sticky; top: 0; z-index: 50; background: rgba(15,15,15,0.95); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border-bottom: 1px solid var(--border); padding: 0 12px; display: flex; align-items: center; }
.nav-logo { display: flex; align-items: center; gap: 7px; padding: 11px 0; margin-right: 8px; flex-shrink: 0; }
.logo-icon { width: 27px; height: 27px; background: var(--accent); border-radius: 6px; display: flex; align-items: center; justify-content: center; }
.logo-icon svg { width: 14px; height: 14px; fill: #0f0f0f; }
.nav-title { font-size: 13px; font-weight: 700; letter-spacing: -0.3px; }
.nav-tabs { display: flex; flex: 1; overflow-x: auto; scrollbar-width: none; }
.nav-tabs::-webkit-scrollbar { display: none; }
.nav-tab { flex-shrink: 0; padding: 13px 8px; font-size: 11px; font-weight: 500; text-align: center; color: var(--text3); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: var(--font); transition: color 0.15s, border-color 0.15s; -webkit-tap-highlight-color: transparent; white-space: nowrap; }
.nav-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.search-section { padding: 13px 16px 0; }
.input-row { display: flex; gap: 7px; margin-bottom: 7px; }
.input-group { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text3); }
.text-input { width: 100%; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 14px; color: var(--text); font-family: var(--font); outline: none; transition: border-color 0.15s; -webkit-appearance: none; }
.text-input::placeholder { color: var(--text3); }
.text-input:focus { border-color: var(--accent); }
.btn-primary { padding: 10px 14px; background: var(--accent); color: #0f0f0f; font-family: var(--font); font-size: 14px; font-weight: 600; border: none; border-radius: var(--radius-sm); cursor: pointer; transition: opacity 0.15s, transform 0.1s; -webkit-tap-highlight-color: transparent; white-space: nowrap; }
.btn-primary:active { transform: scale(0.97); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.btn-ghost { padding: 9px 12px; background: var(--bg3); color: var(--text2); font-family: var(--font); font-size: 13px; font-weight: 500; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: border-color 0.15s, color 0.15s; -webkit-tap-highlight-color: transparent; white-space: nowrap; }
.btn-ghost:hover { border-color: var(--border2); color: var(--text); }
.suggestions-row { display: flex; gap: 5px; overflow-x: auto; padding: 7px 0 10px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.suggestions-row::-webkit-scrollbar { display: none; }
.chip { flex-shrink: 0; font-size: 12px; color: var(--text2); padding: 5px 11px; border: 1px solid var(--border); border-radius: 99px; cursor: pointer; white-space: nowrap; background: var(--bg2); -webkit-tap-highlight-color: transparent; }
.chip:active { border-color: var(--accent); color: var(--accent); }

.loading-screen { padding: 50px 16px; text-align: center; }
.loading-spinner { width: 32px; height: 32px; border: 2px solid var(--border2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 14px; color: var(--text2); }
.loading-sub { font-size: 12px; color: var(--text3); margin-top: 4px; }
.error-card { margin: 10px 16px 0; background: rgba(240,112,112,0.1); border: 1px solid rgba(240,112,112,0.3); border-radius: var(--radius); padding: 12px 14px; font-size: 14px; color: var(--red); line-height: 1.5; }
.empty-state { padding: 44px 16px; text-align: center; }
.empty-icon { font-size: 32px; margin-bottom: 10px; }
.empty-title { font-size: 15px; font-weight: 500; color: var(--text2); }
.empty-sub { font-size: 13px; color: var(--text3); margin-top: 5px; line-height: 1.5; }

.song-card { margin: 10px 16px 0; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; animation: slideUp 0.22s ease; }
@keyframes slideUp { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform:none; } }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
.song-card-header { padding: 12px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.song-title { font-size: 16px; font-weight: 600; letter-spacing: -0.3px; }
.song-artist { font-size: 12px; color: var(--text2); margin-top: 2px; }
.song-actions { display: flex; gap: 5px; flex-shrink: 0; }
.icon-btn { width: 32px; height: 32px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg3); color: var(--text2); font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; -webkit-tap-highlight-color: transparent; }
.icon-btn:active, .icon-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }

.pills-row { padding: 8px 14px; display: flex; gap: 5px; flex-wrap: wrap; border-bottom: 1px solid var(--border); }
.pill { font-family: var(--mono); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 99px; }
.pill-key { background: var(--accent-bg); color: var(--accent); }
.pill-bpm { background: var(--blue-bg); color: var(--blue); }
.pill-time { background: var(--green-bg); color: var(--green); }
.pill-pco { background: var(--purple-bg); color: var(--purple); }

.transposer { padding: 8px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 9px; }
.transposer-label { font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text3); }
.transpose-btns { display: flex; gap: 4px; }
.t-btn { width: 28px; height: 28px; border-radius: 5px; border: 1px solid var(--border); background: var(--bg3); color: var(--text2); font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: var(--mono); -webkit-tap-highlight-color: transparent; }
.t-btn:active { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }
.t-current { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--accent); min-width: 52px; text-align: center; }
.t-reset { font-size: 11px; color: var(--text3); padding: 3px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; background: none; font-family: var(--font); }

.tab-nav { display: flex; border-bottom: 1px solid var(--border); }
.tab-nav-btn { flex: 1; padding: 10px 4px; font-size: 12px; font-weight: 500; color: var(--text3); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: var(--font); transition: color 0.15s, border-color 0.15s; -webkit-tap-highlight-color: transparent; }
.tab-nav-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
.tab-content { padding: 13px 14px; animation: fadeIn 0.18s ease; }

.section-block { margin-bottom: 16px; }
.section-name { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--text3); margin-bottom: 6px; }
.chord-grid { display: flex; flex-wrap: wrap; gap: 5px; }
.chord-cell { display: flex; flex-direction: column; align-items: center; min-width: 52px; padding: 8px 7px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); transition: all 0.12s; }
.chord-cell.playing { background: var(--accent-bg); border-color: var(--accent); }
.chord-cell.playing .chord-name { color: var(--accent); }
.chord-name { font-family: var(--mono); font-size: 16px; font-weight: 700; color: var(--text); line-height: 1; }
.chord-beats { font-size: 10px; color: var(--text3); margin-top: 3px; }
.chord-func { font-size: 11px; font-weight: 700; color: var(--accent); margin-top: 3px; font-family: var(--mono); background: var(--accent-bg); padding: 1px 5px; border-radius: 3px; }

.tab-section-block { margin-bottom: 16px; }
.tab-section-name { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--text3); margin-bottom: 6px; }
.tab-staff { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.tab-row { display: flex; align-items: center; margin-bottom: 3px; }
.string-label { font-family: var(--mono); font-size: 12px; font-weight: 700; color: var(--accent); width: 18px; flex-shrink: 0; }
.string-notes { font-family: var(--mono); font-size: 12px; color: var(--text); white-space: pre; border-bottom: 1px solid var(--border2); padding-bottom: 2px; flex: 1; }
.tab-desc { font-size: 12px; color: var(--text2); margin-top: 7px; line-height: 1.5; font-style: italic; }

.notes-section { margin-bottom: 14px; }
.notes-heading { font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--accent); margin-bottom: 5px; }
.notes-body { font-size: 14px; color: var(--text2); line-height: 1.65; }
.tip-list { list-style: none; }
.tip-list li { font-size: 14px; color: var(--text2); line-height: 1.65; padding-left: 16px; position: relative; margin-bottom: 3px; }
.tip-list li::before { content: '→'; position: absolute; left: 0; color: var(--accent); font-size: 12px; }

.transport { position: fixed; bottom: 0; z-index: 40; left: 50%; transform: translateX(-50%); width: 100%; max-width: 640px; background: rgba(15,15,15,0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-top: 1px solid var(--border); padding: 9px 16px; padding-bottom: calc(9px + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 9px; }
.transport-btn { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--border); background: var(--bg3); color: var(--text); font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.12s; flex-shrink: 0; -webkit-tap-highlight-color: transparent; }
.transport-btn.play-btn { background: var(--accent); border-color: var(--accent); color: #0f0f0f; font-size: 15px; }
.transport-btn:active { transform: scale(0.92); }
.transport-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
.bpm-group { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.bpm-row { display: flex; align-items: center; justify-content: space-between; }
.bpm-label { font-size: 10px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.6px; }
.bpm-number { font-family: var(--mono); font-size: 12px; font-weight: 700; color: var(--accent); }
.bpm-slider { width: 100%; height: 3px; border-radius: 2px; -webkit-appearance: none; appearance: none; background: var(--bg3); outline: none; cursor: pointer; }
.bpm-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 15px; height: 15px; border-radius: 50%; background: var(--accent); cursor: pointer; border: none; }
.playhead-display { font-family: var(--mono); font-size: 10px; color: var(--text3); text-align: right; flex-shrink: 0; min-width: 56px; }

/* ── Library ── */
.library-view { padding: 14px 16px; }
.library-label { font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text3); margin-bottom: 10px; }
.library-empty { text-align: center; padding: 40px 0; color: var(--text3); font-size: 14px; line-height: 1.6; }
.library-items { display: flex; flex-direction: column; gap: 6px; }
.library-item { display: flex; align-items: center; gap: 10px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 11px 13px; cursor: pointer; transition: border-color 0.15s; -webkit-tap-highlight-color: transparent; }
.library-item:active { border-color: var(--accent); }
.library-item-info { flex: 1; min-width: 0; }
.library-item-title { font-size: 14px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.library-item-sub { font-size: 11px; color: var(--text3); margin-top: 2px; font-family: var(--mono); }
.library-item-actions { display: flex; gap: 5px; flex-shrink: 0; }
.lib-btn { padding: 5px 10px; font-size: 11px; font-weight: 500; font-family: var(--font); border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg3); color: var(--text2); cursor: pointer; -webkit-tap-highlight-color: transparent; white-space: nowrap; }
.lib-btn:active { border-color: var(--accent); color: var(--accent); }

/* ── Setlist ── */
.setlist-view { padding: 14px 16px; }
.setlist-name-input { font-size: 17px; font-weight: 600; color: var(--text); background: none; border: none; border-bottom: 1px solid var(--border); outline: none; font-family: var(--font); padding: 2px 0; width: 100%; margin-bottom: 14px; transition: border-color 0.15s; }
.setlist-name-input:focus { border-bottom-color: var(--accent); }
.add-song-area { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 11px 13px; margin-bottom: 13px; }
.add-area-label { font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text3); margin-bottom: 7px; }
.add-song-row { display: flex; gap: 5px; }
.add-song-row .text-input { font-size: 13px; padding: 8px 10px; }
.add-btn { padding: 8px 12px; background: var(--accent-bg); color: var(--accent); font-family: var(--font); font-size: 13px; font-weight: 600; border: 1px solid var(--accent); border-radius: var(--radius-sm); cursor: pointer; -webkit-tap-highlight-color: transparent; white-space: nowrap; }
.add-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.setlist-empty { text-align: center; padding: 28px 0; color: var(--text3); font-size: 14px; line-height: 1.6; }
.setlist-items { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.setlist-item { display: flex; align-items: center; gap: 7px; background: var(--bg2); border: 1px solid var(--border); border-left: 3px solid var(--border); border-radius: var(--radius-sm); padding: 10px 11px; transition: border-color 0.12s; }
.setlist-item.loaded { border-left-color: var(--green); }
.setlist-item.loading { border-left-color: var(--accent); }
.setlist-item.error { border-left-color: var(--red); }
.item-drag-handle { color: var(--text3); font-size: 16px; cursor: grab; padding: 0 2px; flex-shrink: 0; touch-action: none; user-select: none; }
.item-num { font-family: var(--mono); font-size: 11px; color: var(--text3); width: 14px; flex-shrink: 0; }
.item-info { flex: 1; min-width: 0; }
.item-title { font-size: 14px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-sub { font-size: 11px; color: var(--text3); margin-top: 1px; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.status-dot.loaded { background: var(--green); }
.status-dot.loading { background: var(--accent); animation: blink 1s ease-in-out infinite; }
.status-dot.error { background: var(--red); }
.status-dot.pending { background: var(--border2); }
@keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.25;} }
@keyframes iconPop { from { opacity:0; transform: scale(0.5); } to { opacity:1; transform: scale(1); } }
@keyframes fadeUp { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }
@keyframes splashFade { 0%{opacity:1;} 80%{opacity:1;} 100%{opacity:0;} }
.item-load-btn { padding: 4px 9px; font-size: 11px; font-family: var(--font); font-weight: 500; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text2); cursor: pointer; white-space: nowrap; -webkit-tap-highlight-color: transparent; }
.item-del { color: var(--text3); font-size: 17px; padding: 2px 4px; border: none; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; flex-shrink: 0; }
.setlist-footer { display: flex; gap: 7px; flex-wrap: wrap; }
.stage-btn { flex: 1; padding: 13px 18px; background: var(--accent); color: #0f0f0f; font-family: var(--font); font-size: 15px; font-weight: 700; border: none; border-radius: var(--radius); cursor: pointer; transition: opacity 0.15s, transform 0.1s; -webkit-tap-highlight-color: transparent; }
.stage-btn:active { transform: scale(0.97); }
.stage-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
.load-all-btn { padding: 13px 12px; background: var(--bg3); color: var(--text2); font-family: var(--font); font-size: 13px; font-weight: 500; border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.load-all-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.saved-setlists { margin-top: 20px; }
.saved-label { font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text3); margin-bottom: 8px; }
.saved-item { display: flex; align-items: center; gap: 10px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; cursor: pointer; transition: border-color 0.15s; margin-bottom: 5px; -webkit-tap-highlight-color: transparent; }
.saved-item:active { border-color: var(--accent); }
.saved-item-info { flex: 1; min-width: 0; }
.saved-item-name { font-size: 14px; font-weight: 500; color: var(--text); }
.saved-item-meta { font-size: 12px; color: var(--text3); margin-top: 2px; }
.saved-item-del { color: var(--text3); font-size: 18px; padding: 2px 6px; border: none; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }

/* ── Planning Center / Services tab ── */
.pco-view { padding: 14px 16px; }
.pco-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.pco-title { font-size: 15px; font-weight: 600; color: var(--text); }
.pco-subtitle { font-size: 12px; color: var(--text3); margin-top: 2px; }
.sync-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--purple-bg); color: var(--purple); font-family: var(--font); font-size: 13px; font-weight: 600; border: 1px solid var(--purple); border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s; -webkit-tap-highlight-color: transparent; white-space: nowrap; }
.sync-btn:active { opacity: 0.8; }
.sync-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.sync-icon { font-size: 14px; }
.sync-icon.spinning { animation: spin 1s linear infinite; display: inline-block; }

.pco-section-label { font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text3); margin-bottom: 8px; margin-top: 16px; }
.pco-section-label:first-of-type { margin-top: 0; }

.service-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 10px; overflow: hidden; cursor: pointer; transition: border-color 0.15s; -webkit-tap-highlight-color: transparent; }
.service-card:active { border-color: var(--accent); }
.service-card.expanded { border-color: var(--purple); }
.service-card-header { padding: 13px 14px; display: flex; align-items: center; gap: 12px; }
.service-date-badge { background: var(--purple-bg); color: var(--purple); border-radius: var(--radius-sm); padding: 6px 10px; text-align: center; flex-shrink: 0; }
.service-date-day { font-family: var(--mono); font-size: 18px; font-weight: 700; line-height: 1; }
.service-date-month { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
.service-info { flex: 1; min-width: 0; }
.service-name { font-size: 14px; font-weight: 600; color: var(--text); }
.service-meta { font-size: 12px; color: var(--text3); margin-top: 2px; }
.service-chevron { color: var(--text3); font-size: 12px; flex-shrink: 0; transition: transform 0.2s; }
.service-card.expanded .service-chevron { transform: rotate(90deg); }
.scheduled-badge { font-size: 10px; font-weight: 600; background: var(--green-bg); color: var(--green); padding: 2px 7px; border-radius: 99px; margin-top: 3px; display: inline-block; }

.service-songs { border-top: 1px solid var(--border); padding: 12px 14px; animation: fadeIn 0.18s ease; }
.service-songs-label { font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text3); margin-bottom: 8px; }

.pco-song-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border); }
.pco-song-row:last-child { border-bottom: none; }
.pco-song-num { font-family: var(--mono); font-size: 11px; color: var(--text3); width: 16px; flex-shrink: 0; }
.pco-song-info { flex: 1; min-width: 0; }
.pco-song-title { font-size: 14px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pco-song-meta { font-size: 11px; color: var(--text3); margin-top: 1px; font-family: var(--mono); }
.pco-song-actions { display: flex; gap: 5px; flex-shrink: 0; }
.pco-btn { padding: 5px 10px; font-size: 11px; font-weight: 500; font-family: var(--font); border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg3); color: var(--text2); cursor: pointer; -webkit-tap-highlight-color: transparent; white-space: nowrap; transition: all 0.12s; }
.pco-btn:active { border-color: var(--accent); color: var(--accent); }
.pco-btn.pdf { border-color: rgba(181,156,246,0.4); color: var(--purple); background: var(--purple-bg); }
.pco-btn.pdf:active { opacity: 0.7; }

.import-all-btn { width: 100%; padding: 11px; background: var(--purple-bg); color: var(--purple); font-family: var(--font); font-size: 13px; font-weight: 600; border: 1px solid var(--purple); border-radius: var(--radius-sm); cursor: pointer; margin-top: 10px; -webkit-tap-highlight-color: transparent; transition: opacity 0.15s; }
.import-all-btn:active { opacity: 0.75; }

/* PDF viewer overlay */
.pdf-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.92); display: flex; flex-direction: column; max-width: 640px; margin: 0 auto; }
.pdf-topbar { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
.pdf-song-title { font-size: 14px; font-weight: 600; color: var(--text); }
.pdf-song-artist { font-size: 11px; color: var(--text3); margin-top: 1px; }
.pdf-close { padding: 6px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: none; color: var(--text2); font-size: 12px; font-family: var(--font); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.pdf-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; }
.pdf-frame { width: 100%; height: 100%; border: none; border-radius: var(--radius-sm); background: white; }
.pdf-loading { text-align: center; color: var(--text2); font-size: 14px; }
.pdf-open-btn { margin-top: 14px; padding: 11px 20px; background: var(--purple); color: #0f0f0f; font-family: var(--font); font-size: 14px; font-weight: 600; border: none; border-radius: var(--radius-sm); cursor: pointer; -webkit-tap-highlight-color: transparent; }

/* ── Stage mode ── */
.stage-overlay { position: fixed; inset: 0; z-index: 200; background: var(--bg); display: flex; flex-direction: column; max-width: 640px; margin: 0 auto; }
.stage-topbar { background: rgba(15,15,15,0.96); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
.stage-setlist-name { font-size: 11px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text3); }
.stage-counter { font-family: var(--mono); font-size: 12px; color: var(--text3); margin-top: 1px; }
.stage-exit-btn { padding: 5px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: none; color: var(--text2); font-size: 12px; font-family: var(--font); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.stage-progress { display: flex; justify-content: center; align-items: center; gap: 5px; padding: 7px 0 0; flex-shrink: 0; }
.stage-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--border2); transition: all 0.2s; cursor: pointer; }
.stage-dot.active { background: var(--accent); width: 20px; border-radius: 3px; }
.stage-dot.done { background: var(--text3); }
.swipe-hint { text-align: center; font-size: 11px; color: var(--text3); padding: 4px 0 8px; flex-shrink: 0; }
.stage-body { flex: 1; overflow: hidden; position: relative; }
.stage-track { display: flex; height: 100%; will-change: transform; }
.stage-panel { flex: 0 0 100%; height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 14px 16px 110px; }
.stage-song-title { font-size: 21px; font-weight: 700; letter-spacing: -0.5px; }
.stage-song-artist { font-size: 13px; color: var(--text2); margin-top: 2px; margin-bottom: 10px; }
.stage-transposer { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding: 7px 11px; background: var(--bg2); border-radius: var(--radius-sm); border: 1px solid var(--border); }
.stage-t-label { font-size: 10px; font-weight: 600; letter-spacing: 0.7px; text-transform: uppercase; color: var(--text3); }
.stage-t-btn { width: 27px; height: 27px; border-radius: 5px; border: 1px solid var(--border); background: var(--bg3); color: var(--text2); font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: var(--mono); -webkit-tap-highlight-color: transparent; }
.stage-t-btn:active { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }
.stage-t-key { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--accent); min-width: 48px; text-align: center; }
.stage-t-reset { font-size: 11px; color: var(--text3); padding: 3px 7px; border: 1px solid var(--border); border-radius: 5px; cursor: pointer; background: none; font-family: var(--font); }
.stage-tabs { display: flex; gap: 4px; margin-bottom: 10px; }
.stage-tab { padding: 5px 12px; font-size: 12px; font-weight: 500; border: 1px solid var(--border); border-radius: 99px; background: none; color: var(--text3); font-family: var(--font); cursor: pointer; transition: all 0.12s; -webkit-tap-highlight-color: transparent; }
.stage-tab.active { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }
.stage-nav { position: fixed; bottom: 0; z-index: 201; left: 50%; transform: translateX(-50%); width: 100%; max-width: 640px; background: rgba(15,15,15,0.97); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border-top: 1px solid var(--border); padding: 10px 16px; padding-bottom: calc(10px + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 10px; }
.snav-btn { display: flex; align-items: center; justify-content: center; gap: 5px; padding: 12px 14px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg3); color: var(--text2); font-family: var(--font); font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; -webkit-tap-highlight-color: transparent; min-width: 75px; }
.snav-btn:active { background: var(--bg4); }
.snav-btn:disabled { opacity: 0.25; cursor: not-allowed; }
.snav-btn.next { background: var(--accent); border-color: var(--accent); color: #0f0f0f; font-weight: 700; flex: 1; }
.snav-btn.next:active { opacity: 0.85; }
.stage-cur { text-align: center; flex: 0; min-width: 0; }
.stage-cur-title { font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
.stage-cur-key { font-family: var(--mono); font-size: 11px; color: var(--accent); margin-top: 1px; }
`;

// ── ChartContent component ───────────────────────────────────────────────────
function ChartContent({ data, transpose, onTransposeChange, showTransport }) {
  const [activeTab, setActiveTab] = useState('chart');
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(data?.bpm || 72);
  const [curIdx, setCurIdx] = useState(0);
  const playRef = useRef(null);
  const allRef = useRef([]);

  useEffect(() => {
    if (!data) return;
    const flat = [];
    data.sections?.forEach(sec => sec.chords?.forEach((c, i) => flat.push({ ...c, section: sec.name, idx: i })));
    allRef.current = flat;
    setBpm(data.bpm || 72);
    setIsPlaying(false);
    setCurIdx(0);
  }, [data]);

  useEffect(() => {
    if (isPlaying && data) {
      const iv = setInterval(() => setCurIdx(p => (p + 1) % Math.max(allRef.current.length, 1)), (60000 / bpm) * 4);
      playRef.current = iv;
      return () => clearInterval(iv);
    }
    clearInterval(playRef.current);
  }, [isPlaying, bpm, data]);

  if (!data) return null;
  const tc = c => transposeChord(c, transpose);
  const tKey = transposeKey(data.key || '', transpose);
  const cur = allRef.current[curIdx];

  return (
    <>
      <div className="pills-row">
        <span className="pill pill-key">Key: {tKey}</span>
        <span className="pill pill-bpm">♩ {bpm}</span>
        <span className="pill pill-time">{data.timeSignature || '4/4'}</span>
        {data.fromPCO && <span className="pill pill-pco">Planning Center</span>}
        {transpose !== 0 && <span className="pill" style={{ background:'rgba(255,255,255,0.06)', color:'var(--text2)' }}>{transpose > 0 ? `+${transpose}` : transpose} st</span>}
      </div>
      <div className="transposer">
        <span className="transposer-label">Transpose</span>
        <div className="transpose-btns">
          <button className="t-btn" onClick={() => onTransposeChange(transpose - 1)}>−</button>
          <button className="t-btn" onClick={() => onTransposeChange(transpose + 1)}>+</button>
        </div>
        <span className="t-current">{tKey}</span>
        {transpose !== 0 && <button className="t-reset" onClick={() => onTransposeChange(0)}>reset</button>}
      </div>
      <div className="tab-nav">
        {['chart','tab','notes'].map(t => (
          <button key={t} className={`tab-nav-btn${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'chart' ? 'Chord Chart' : t === 'tab' ? 'Bass Tab' : 'Player Notes'}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {activeTab === 'chart' && data.sections?.map(sec => (
          <div key={sec.name} className="section-block">
            <div className="section-name">{sec.name}</div>
            <div className="chord-grid">
              {sec.chords?.map((c, i) => {
                const on = isPlaying && cur?.section === sec.name && cur?.idx === i;
                return (
                  <div key={i} className={`chord-cell${on ? ' playing' : ''}`}>
                    <div className="chord-name">{tc(c.chord)}</div>
                    <div className="chord-beats">{c.beats}b</div>
                    {c.function && <div className="chord-func">{romanToNashville(c.function)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {activeTab === 'tab' && (!data.bassTab
          ? <div style={{ color:'var(--text3)', fontSize:14 }}>No tab available.</div>
          : Object.entries(data.bassTab).map(([sn, d]) => (
            <div key={sn} className="tab-section-block">
              <div className="tab-section-name">{sn}</div>
              <div className="tab-staff">
                {['G','D','A','E'].map(s => (
                  <div key={s} className="tab-row">
                    <span className="string-label">{s}</span>
                    <span className="string-notes">{d[s] || '|------------|'}</span>
                  </div>
                ))}
                {d.description && <div className="tab-desc">{d.description}</div>}
              </div>
            </div>
          ))
        )}
        {activeTab === 'notes' && data.bassNotes && (
          <>
            {data.bassNotes.feel && <div className="notes-section"><div className="notes-heading">Feel & groove</div><div className="notes-body">{data.bassNotes.feel}</div></div>}
            {data.bassNotes.rootNotes && <div className="notes-section"><div className="notes-heading">Root notes</div><div className="notes-body">{data.bassNotes.rootNotes}</div></div>}
            {data.bassNotes.dynamics && <div className="notes-section"><div className="notes-heading">Dynamics</div><div className="notes-body">{data.bassNotes.dynamics}</div></div>}
            {data.bassNotes.tips?.length > 0 && <div className="notes-section"><div className="notes-heading">Player tips</div><ul className="tip-list">{data.bassNotes.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          </>
        )}
      </div>
      {showTransport && (
        <div className="transport">
          <button className="transport-btn play-btn" onClick={() => setIsPlaying(p => !p)}>{isPlaying ? '⏸' : '▶'}</button>
          <button className="transport-btn" onClick={() => { setIsPlaying(false); setCurIdx(0); }}>↺</button>
          <div className="bpm-group">
            <div className="bpm-row">
              <span className="bpm-label">Tempo</span>
              <span className="bpm-number">♩ {bpm}</span>
            </div>
            <input type="range" min="40" max="200" step="1" value={bpm} className="bpm-slider" onChange={e => setBpm(parseInt(e.target.value))} />
          </div>
          {isPlaying && cur && (
            <div className="playhead-display">
              <div style={{ color:'var(--accent)', fontWeight:700, fontSize:14 }}>{tc(cur.chord)}</div>
              <div>{cur.section}</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Stage Mode ───────────────────────────────────────────────────────────────
function StageMode({ setlistName, songs, onExit }) {
  const [idx, setIdx] = useState(0);
  const [tps, setTps] = useState(() => songs.map(() => 0));
  const [tabs, setTabs] = useState(() => songs.map(() => 'chart'));
  const touchStartX = useRef(null);
  const [dragX, setDragX] = useState(0);
  const isDragging = useRef(false);

  const total = songs.length;
  const cur = songs[idx];
  const st = tps[idx] || 0;
  const tKey = cur?.data ? transposeKey(cur.data.key || '', st) : '';

  function goTo(i) { if (i >= 0 && i < total) { setIdx(i); setDragX(0); } }
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; isDragging.current = true; }
  function onTouchMove(e) { if (!isDragging.current) return; setDragX(e.touches[0].clientX - touchStartX.current); }
  function onTouchEnd() {
    isDragging.current = false;
    if (dragX < -60 && idx < total - 1) goTo(idx + 1);
    else if (dragX > 60 && idx > 0) goTo(idx - 1);
    else setDragX(0);
  }

  const trackStyle = {
    transform: `translateX(calc(${-idx * 100}% + ${dragX}px))`,
    transition: isDragging.current ? 'none' : 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)',
  };
  const tc = (chord, si) => transposeChord(chord, tps[si] || 0);

  return (
    <div className="stage-overlay">
      <div className="stage-topbar">
        <div>
          <div className="stage-setlist-name">{setlistName}</div>
          <div className="stage-counter">{idx + 1} / {total}</div>
        </div>
        <button className="stage-exit-btn" onClick={onExit}>✕ Exit stage</button>
      </div>
      <div className="stage-progress">
        {songs.map((_, i) => <div key={i} className={`stage-dot${i === idx ? ' active' : i < idx ? ' done' : ''}`} onClick={() => goTo(i)} />)}
      </div>
      <div className="swipe-hint">swipe left / right to navigate</div>
      <div className="stage-body" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="stage-track" style={trackStyle}>
          {songs.map((song, si) => {
            const s = tps[si] || 0;
            const sKey = song.data ? transposeKey(song.data.key || '', s) : '';
            const sTab = tabs[si] || 'chart';
            return (
              <div key={si} className="stage-panel">
                <div className="stage-song-title">{song.title}</div>
                <div className="stage-song-artist">{song.artist}</div>
                {song.status === 'loading' && <div style={{ textAlign:'center', padding:'40px 0' }}><div className="loading-spinner" style={{ margin:'0 auto 10px' }} /><div style={{ fontSize:13, color:'var(--text3)' }}>Loading…</div></div>}
                {song.status === 'error' && <div style={{ fontSize:14, color:'var(--red)', padding:'20px 0' }}>Failed to load chart.</div>}
                {song.data && (
                  <>
                    <div className="pills-row" style={{ padding:'0 0 8px' }}>
                      <span className="pill pill-key">Key: {sKey}</span>
                      <span className="pill pill-bpm">♩ {song.data.bpm}</span>
                      <span className="pill pill-time">{song.data.timeSignature || '4/4'}</span>
                      {s !== 0 && <span className="pill" style={{ background:'rgba(255,255,255,0.06)', color:'var(--text2)' }}>{s > 0 ? `+${s}` : s} st</span>}
                    </div>
                    <div className="stage-transposer">
                      <span className="stage-t-label">Key</span>
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="stage-t-btn" onClick={() => setTps(p => { const n=[...p]; n[si]--; return n; })}>−</button>
                        <button className="stage-t-btn" onClick={() => setTps(p => { const n=[...p]; n[si]++; return n; })}>+</button>
                      </div>
                      <span className="stage-t-key">{sKey}</span>
                      {s !== 0 && <button className="stage-t-reset" onClick={() => setTps(p => { const n=[...p]; n[si]=0; return n; })}>reset</button>}
                    </div>
                    <div className="stage-tabs">
                      {['chart','tab','notes'].map(t => (
                        <button key={t} className={`stage-tab${sTab === t ? ' active' : ''}`} onClick={() => setTabs(p => { const n=[...p]; n[si]=t; return n; })}>
                          {t === 'chart' ? 'Chords' : t === 'tab' ? 'Tab' : 'Notes'}
                        </button>
                      ))}
                    </div>
                    {sTab === 'chart' && song.data.sections?.map(sec => (
                      <div key={sec.name} className="section-block">
                        <div className="section-name">{sec.name}</div>
                        <div className="chord-grid">
                          {sec.chords?.map((c, i) => (
                            <div key={i} className="chord-cell">
                              <div className="chord-name">{tc(c.chord, si)}</div>
                              <div className="chord-beats">{c.beats}b</div>
                              {c.function && <div className="chord-func">{romanToNashville(c.function)}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {sTab === 'tab' && (!song.data.bassTab ? <div style={{ color:'var(--text3)', fontSize:14 }}>No tab available.</div> : Object.entries(song.data.bassTab).map(([sn, d]) => (
                      <div key={sn} className="tab-section-block">
                        <div className="tab-section-name">{sn}</div>
                        <div className="tab-staff">
                          {['G','D','A','E'].map(s2 => <div key={s2} className="tab-row"><span className="string-label">{s2}</span><span className="string-notes">{d[s2] || '|------------|'}</span></div>)}
                          {d.description && <div className="tab-desc">{d.description}</div>}
                        </div>
                      </div>
                    )))}
                    {sTab === 'notes' && song.data.bassNotes && (
                      <>
                        {song.data.bassNotes.feel && <div className="notes-section"><div className="notes-heading">Feel & groove</div><div className="notes-body">{song.data.bassNotes.feel}</div></div>}
                        {song.data.bassNotes.rootNotes && <div className="notes-section"><div className="notes-heading">Root notes</div><div className="notes-body">{song.data.bassNotes.rootNotes}</div></div>}
                        {song.data.bassNotes.dynamics && <div className="notes-section"><div className="notes-heading">Dynamics</div><div className="notes-body">{song.data.bassNotes.dynamics}</div></div>}
                        {song.data.bassNotes.tips?.length > 0 && <div className="notes-section"><div className="notes-heading">Player tips</div><ul className="tip-list">{song.data.bassNotes.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="stage-nav">
        <button className="snav-btn" onClick={() => goTo(idx - 1)} disabled={idx === 0}>← Prev</button>
        <div className="stage-cur">
          <div className="stage-cur-title">{cur?.title}</div>
          <div className="stage-cur-key">{tKey}</div>
        </div>
        <button className="snav-btn next" onClick={() => goTo(idx + 1)} disabled={idx === total - 1}>Next →</button>
      </div>
    </div>
  );
}

// ── PDF Viewer overlay ───────────────────────────────────────────────────────
function PDFViewer({ song, url, onClose }) {
  return (
    <div className="pdf-overlay">
      <div className="pdf-topbar">
        <div>
          <div className="pdf-song-title">{song.title}</div>
          <div className="pdf-song-artist">{song.artist}</div>
        </div>
        <button className="pdf-close" onClick={onClose}>✕ Close</button>
      </div>
      <div className="pdf-body">
        {url ? (
          <>
            <iframe className="pdf-frame" src={url} title={song.title} />
            <a href={url} target="_blank" rel="noopener noreferrer">
              <button className="pdf-open-btn">Open in browser ↗</button>
            </a>
          </>
        ) : (
          <div className="pdf-loading">
            <div className="loading-spinner" style={{ margin:'0 auto 12px' }} />
            Loading chord chart…
          </div>
        )}
      </div>
    </div>
  );
}

// ── Planning Center Services view ────────────────────────────────────────────
function ServicesView({ onAddToSetlist }) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [myPlans, setMyPlans] = useState([]);
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [planSongs, setPlanSongs] = useState({}); // keyed by planId
  const [loadingSongs, setLoadingSongs] = useState({});
  const [pdfViewer, setPdfViewer] = useState(null); // { song, url }
  const [loadingPdf, setLoadingPdf] = useState({});
  const [hasLoaded, setHasLoaded] = useState(false);

  async function syncPlans() {
    setSyncing(true);
    setError('');
    try {
      const data = await pcoGet('myPlans');
      const planPeople = data.data || [];
      const included = data.included || [];

      // Build a map of included resources
      const includedMap = {};
      included.forEach(i => { includedMap[`${i.type}:${i.id}`] = i; });

      // Deduplicate by plan ID — person may appear multiple times per plan
      const seenPlanIds = new Set();
      const enriched = [];

      planPeople.forEach(pp => {
        const planRel = pp.relationships?.plan?.data;
        const stRel = pp.relationships?.service_type?.data;
        if (!planRel || seenPlanIds.has(planRel.id)) return;
        seenPlanIds.add(planRel.id);

        const plan = includedMap[`Plan:${planRel.id}`];
        const st = stRel ? includedMap[`ServiceType:${stRel.id}`] : null;

        enriched.push({
          id: planRel.id,
          serviceTypeId: st?.id || stRel?.id,
          serviceName: st?.attributes?.name || 'Service',
          date: plan?.attributes?.sort_date,
          title: plan?.attributes?.title || '',
          totalLength: plan?.attributes?.total_length,
        });
      });

      // Sort by date ascending
      enriched.sort((a, b) => new Date(a.date) - new Date(b.date));
      setMyPlans(enriched);
      setHasLoaded(true);
    } catch (e) {
      setError('Could not connect to Planning Center. ' + e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function loadPlanSongs(plan) {
    const key = plan.id;
    if (planSongs[key] || loadingSongs[key]) return;
    setLoadingSongs(p => ({ ...p, [key]: true }));
    try {
      const data = await pcoGet('planItems', { serviceTypeId: plan.serviceTypeId, planId: plan.id });
      const items = (data.data || []).filter(i => i.attributes?.item_type === 'song');
      const included = data.included || [];
      const songs = items.map((item, idx) => {
        const songRel = item.relationships?.song?.data;
        const arrRel = item.relationships?.arrangement?.data;
        const keyRel = item.relationships?.key?.data;
        const song = songRel ? included.find(i => i.type === 'Song' && i.id === songRel.id) : null;
        const arr = arrRel ? included.find(i => i.type === 'Arrangement' && i.id === arrRel.id) : null;
        const keyObj = keyRel ? included.find(i => i.type === 'Key' && i.id === keyRel.id) : null;
        return {
          itemId: item.id,
          songId: songRel?.id,
          arrangementId: arrRel?.id,
          title: song?.attributes?.title || item.attributes?.title || `Song ${idx + 1}`,
          artist: song?.attributes?.author || '',
          key: keyObj?.attributes?.name || item.attributes?.key_name || '',
          bpm: arr?.attributes?.bpm || '',
          sequence: item.attributes?.sequence || idx,
          serviceTypeId: plan.serviceTypeId,
          planId: plan.id,
        };
      });
      songs.sort((a, b) => a.sequence - b.sequence);
      setPlanSongs(p => ({ ...p, [key]: songs }));
    } catch (e) {
      setError('Could not load songs for this service.');
    } finally {
      setLoadingSongs(p => ({ ...p, [key]: false }));
    }
  }

  async function openPDF(song) {
    setPdfViewer({ song, url: null });
    setLoadingPdf(p => ({ ...p, [song.itemId]: true }));
    try {
      // Get attachments for this plan
      const data = await pcoGet('attachments', { serviceTypeId: song.serviceTypeId, planId: song.planId });
      const attachments = data.data || [];
      // Find a PDF attachment for this song
      const pdf = attachments.find(a => {
        const filename = a.attributes?.filename || '';
        const linked = a.relationships?.attachable?.data;
        const isSong = linked?.type === 'Song' && linked?.id === song.songId;
        const isPDF = filename.toLowerCase().endsWith('.pdf') || a.attributes?.content_type === 'application/pdf';
        return isSong && isPDF;
      }) || attachments.find(a => {
        const filename = a.attributes?.filename || '';
        return filename.toLowerCase().endsWith('.pdf');
      });

      if (pdf) {
        // Get open URL
        const urlData = await pcoGet('attachmentUrl', {
          serviceTypeId: song.serviceTypeId,
          planId: song.planId,
          attachmentId: pdf.id,
        });
        const url = urlData.data?.attributes?.open_url || pdf.attributes?.file_download_url;
        setPdfViewer({ song, url });
      } else {
        setPdfViewer({ song, url: 'none' });
      }
    } catch (e) {
      setPdfViewer({ song, url: 'error' });
    } finally {
      setLoadingPdf(p => ({ ...p, [song.itemId]: false }));
    }
  }

  function togglePlan(plan) {
    if (expandedPlan === plan.id) {
      setExpandedPlan(null);
    } else {
      setExpandedPlan(plan.id);
      loadPlanSongs(plan);
    }
  }

  function importAllToSetlist(planId) {
    const songs = planSongs[planId] || [];
    songs.forEach(song => onAddToSetlist(song));
  }

  const getDateParts = (dateStr) => {
    if (!dateStr) return { day: '?', month: '???', full: '' };
    const d = new Date(dateStr);
    return {
      day: d.getDate(),
      month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      full: formatDate(dateStr),
    };
  };

  return (
    <div className="pco-view">
      <div className="pco-header">
        <div>
          <div className="pco-title">Planning Center</div>
          <div className="pco-subtitle">Your upcoming scheduled services</div>
        </div>
        <button className="sync-btn" onClick={syncPlans} disabled={syncing}>
          <span className={`sync-icon${syncing ? ' spinning' : ''}`}>↻</span>
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {error && <div className="error-card" style={{ marginBottom:12 }}>{error}</div>}

      {!hasLoaded && !syncing && (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <div className="empty-title">Connect to Planning Center</div>
          <div className="empty-sub">Tap Sync to pull your upcoming scheduled services and song lists directly from Planning Center.</div>
        </div>
      )}

      {syncing && (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <div className="loading-text">Connecting to Planning Center…</div>
        </div>
      )}

      {hasLoaded && !syncing && myPlans.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🎵</div>
          <div className="empty-title">No upcoming services found</div>
          <div className="empty-sub">You don't appear to be scheduled for any upcoming services, or your account may need Songs access enabled by your worship leader.</div>
        </div>
      )}

      {hasLoaded && myPlans.length > 0 && (
        <>
          <div className="pco-section-label">Your scheduled services</div>
          {myPlans.map(plan => {
            const dp = getDateParts(plan.date);
            const isExpanded = expandedPlan === plan.id;
            const songs = planSongs[plan.id] || [];
            const isLoadingSongs = loadingSongs[plan.id];
            return (
              <div key={plan.id} className={`service-card${isExpanded ? ' expanded' : ''}`} onClick={() => togglePlan(plan)}>
                <div className="service-card-header">
                  <div className="service-date-badge">
                    <div className="service-date-day">{dp.day}</div>
                    <div className="service-date-month">{dp.month}</div>
                  </div>
                  <div className="service-info">
                    <div className="service-name">{plan.serviceName}</div>
                    <div className="service-meta">{dp.full}</div>
                    <div><span className="scheduled-badge">● You're scheduled</span></div>
                  </div>
                  <div className="service-chevron">▶</div>
                </div>

                {isExpanded && (
                  <div className="service-songs" onClick={e => e.stopPropagation()}>
                    <div className="service-songs-label">Songs</div>
                    {isLoadingSongs && (
                      <div style={{ textAlign:'center', padding:'20px 0' }}>
                        <div className="loading-spinner" style={{ margin:'0 auto 8px' }} />
                        <div style={{ fontSize:13, color:'var(--text3)' }}>Loading songs…</div>
                      </div>
                    )}
                    {!isLoadingSongs && songs.length === 0 && (
                      <div style={{ fontSize:13, color:'var(--text3)', padding:'8px 0' }}>No songs found for this service.</div>
                    )}
                    {songs.map((song, i) => (
                      <div key={song.itemId} className="pco-song-row">
                        <div className="pco-song-num">{i + 1}</div>
                        <div className="pco-song-info">
                          <div className="pco-song-title">{song.title}</div>
                          <div className="pco-song-meta">
                            {song.artist && `${song.artist} · `}
                            {song.key && `Key: ${song.key}`}
                            {song.bpm && ` · ♩${song.bpm}`}
                          </div>
                        </div>
                        <div className="pco-song-actions">
                          <button
                            className="pco-btn pdf"
                            onClick={() => openPDF(song)}
                            disabled={loadingPdf[song.itemId]}
                          >
                            {loadingPdf[song.itemId] ? '…' : '📄 Chart'}
                          </button>
                          <button className="pco-btn" onClick={() => onAddToSetlist(song)}>+ List</button>
                        </div>
                      </div>
                    ))}
                    {songs.length > 0 && (
                      <button className="import-all-btn" onClick={() => importAllToSetlist(plan.id)}>
                        Import all {songs.length} songs to Setlist →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {pdfViewer && (
        <PDFViewer
          song={pdfViewer.song}
          url={pdfViewer.url === 'none' ? null : pdfViewer.url === 'error' ? null : pdfViewer.url}
          onClose={() => setPdfViewer(null)}
        />
      )}
      {pdfViewer?.url === 'none' && (
        <div className="error-card" style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', width:'calc(100% - 32px)', maxWidth:600, zIndex:400 }}>
          No PDF chart found for this song in Planning Center.
          <button onClick={() => setPdfViewer(null)} style={{ float:'right', background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:16 }}>×</button>
        </div>
      )}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('services');
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 2400);
    return () => clearTimeout(t);
  }, []);

  // Search
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [songData, setSongData] = useState(null);
  const [transpose, setTranspose] = useState(0);

  // Library
  const [library, setLibrary] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bass-library') || '[]'); } catch { return []; }
  });

  // Setlist
  const [setlistName, setSetlistName] = useState(() => {
    try { return localStorage.getItem('bass-active-setlist-name') || 'Sunday Service'; } catch { return 'Sunday Service'; }
  });
  const [addTitle, setAddTitle] = useState('');
  const [addArtist, setAddArtist] = useState('');
  const [setlistSongs, setSetlistSongs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bass-active-setlist') || '[]'); } catch { return []; }
  });
  const [savedSetlists, setSavedSetlists] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bass-setlists') || '[]'); } catch { return []; }
  });
  const [stageOpen, setStageOpen] = useState(false);
  // ── Touch drag reorder ──────────────────────────────────────────────────────
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [dragOverVisual, setDragOverVisual] = useState(null);
  const listRef = useRef(null);

  // Desktop drag
  function onDragStart(i) { dragIdx.current = i; setDraggingIdx(i); }
  function onDragOver(e, i) { e.preventDefault(); dragOverIdx.current = i; setDragOverVisual(i); }
  function onDragEnd() { setDraggingIdx(null); setDragOverVisual(null); }
  function onDrop(i) {
    if (dragIdx.current === null || dragIdx.current === i) { dragIdx.current = null; return; }
    setSetlistSongs(p => {
      const arr = [...p]; const [moved] = arr.splice(dragIdx.current, 1); arr.splice(i, 0, moved); return arr;
    });
    dragIdx.current = null; dragOverIdx.current = null;
    setDraggingIdx(null); setDragOverVisual(null);
  }

  // Mobile touch drag
  const touchDragIdx = useRef(null);
  const touchStartY = useRef(0);
  const [touchDragActive, setTouchDragActive] = useState(false);
  const [touchOverIdx, setTouchOverIdx] = useState(null);

  function onTouchHandleStart(e, i) {
    e.preventDefault();
    touchDragIdx.current = i;
    touchStartY.current = e.touches[0].clientY;
    setTouchDragActive(true);
    setTouchOverIdx(i);
  }

  function onTouchHandleMove(e) {
    if (touchDragIdx.current === null) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    setTouchDragY(y);
    // Find which item we're hovering over
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[data-setlist-idx]');
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        if (y >= rect.top && y <= rect.bottom) {
          const idx = parseInt(item.dataset.setlistIdx);
          setTouchOverIdx(idx);
          break;
        }
      }
    }
  }

  function onTouchHandleEnd() {
    if (touchDragIdx.current !== null && touchOverIdx !== null && touchDragIdx.current !== touchOverIdx) {
      const from = touchDragIdx.current;
      const to = touchOverIdx;
      setSetlistSongs(p => {
        const arr = [...p]; const [moved] = arr.splice(from, 1); arr.splice(to, 0, moved); return arr;
      });
    }
    touchDragIdx.current = null;
    setTouchDragActive(false);
    setTouchOverIdx(null);
  }
  useEffect(() => { try { localStorage.setItem('bass-library', JSON.stringify(library)); } catch {} }, [library]);
  useEffect(() => { try { localStorage.setItem('bass-setlists', JSON.stringify(savedSetlists)); } catch {} }, [savedSetlists]);

  // Persist active setlist — saves full chart data so reopening the app restores everything instantly
  useEffect(() => {
    try { localStorage.setItem('bass-active-setlist', JSON.stringify(setlistSongs)); } catch {}
  }, [setlistSongs]);
  useEffect(() => {
    try { localStorage.setItem('bass-active-setlist-name', setlistName); } catch {}
  }, [setlistName]);

  const isInLibrary = songData ? library.some(s => s.title === songData.title && s.artist === songData.artist) : false;

  async function doSearch(title, artist) {
    if (!title.trim()) return;
    setLoading(true); setError(''); setSongData(null); setTranspose(0);
    try { setSongData(await fetchChart(title, artist)); }
    catch { setError('Couldn\'t load that song. Try being more specific or check your connection.'); }
    finally { setLoading(false); }
  }

  function quickSearch(s) { setSongTitle(s.title); setSongArtist(s.artist); doSearch(s.title, s.artist); }

  function saveToLibrary() {
    if (!songData || isInLibrary) return;
    setLibrary(p => [{ ...songData, savedAt: Date.now() }, ...p]);
  }

  function removeFromLibrary(title, artist) {
    setLibrary(p => p.filter(s => !(s.title === title && s.artist === artist)));
  }

  function loadFromLibrary(song) {
    setSongData(song); setTranspose(0); setView('search');
  }

  function addToSetlistFromLibrary(song) {
    setSetlistSongs(p => {
      if (p.some(s => s.title === song.title && s.artist === song.artist)) return p;
      return [...p, { title: song.title, artist: song.artist, status: 'loaded', data: song }];
    });
    setView('setlist');
  }

  // Add from Planning Center — uses key from PCO if available
  function addToSetlistFromPCO(pcoSong) {
    setSetlistSongs(p => {
      if (p.some(s => s.title === pcoSong.title)) return p;
      return [...p, {
        title: pcoSong.title,
        artist: pcoSong.artist || '',
        status: 'pending',
        data: null,
        pcoKey: pcoSong.key || '',
      }];
    });
    setView('setlist');
  }

  // Setlist
  function addToSetlist() {
    if (!addTitle.trim()) return;
    setSetlistSongs(p => [...p, { title: addTitle.trim(), artist: addArtist.trim(), status: 'pending', data: null }]);
    setAddTitle(''); setAddArtist('');
  }

  function removeSong(i) { setSetlistSongs(p => p.filter((_, x) => x !== i)); }

  async function loadSongAt(i) {
    const song = setlistSongs[i];
    if (!song || song.status === 'loaded' || song.status === 'loading') return;
    const cached = library.find(s => s.title === song.title && s.artist === song.artist);
    if (cached) {
      setSetlistSongs(p => { const n=[...p]; n[i]={...n[i], status:'loaded', data:cached}; return n; });
      return;
    }
    setSetlistSongs(p => { const n=[...p]; n[i]={...n[i], status:'loading'}; return n; });
    try {
      const data = await fetchChart(song.title, song.artist);
      // If PCO gave us a key, use it
      if (song.pcoKey && data) data.key = song.pcoKey;
      setSetlistSongs(p => { const n=[...p]; n[i]={...n[i], status:'loaded', data}; return n; });
    } catch {
      setSetlistSongs(p => { const n=[...p]; n[i]={...n[i], status:'error'}; return n; });
    }
  }

  async function loadAll() {
    for (let i = 0; i < setlistSongs.length; i++) {
      if (setlistSongs[i].status === 'pending' || setlistSongs[i].status === 'error') await loadSongAt(i);
    }
  }

  function saveSetlist() {
    if (!setlistSongs.length) return;
    // Check if a setlist with this name already exists — update it instead of duplicating
    const existing = savedSetlists.findIndex(s => s.name === setlistName);
    const sl = {
      id: existing >= 0 ? savedSetlists[existing].id : Date.now(),
      name: setlistName,
      date: new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
      songs: setlistSongs.map(s => ({
        title: s.title,
        artist: s.artist,
        pcoKey: s.pcoKey || '',
        // Save full chart data so reloading is instant
        status: s.status === 'loaded' ? 'loaded' : 'pending',
        data: s.data || null,
      })),
    };
    if (existing >= 0) {
      setSavedSetlists(p => { const n=[...p]; n[existing]=sl; return n; });
    } else {
      setSavedSetlists(p => [sl, ...p]);
    }
  }

  function loadSaved(sl) {
    setSetlistName(sl.name);
    // Restore with full data — songs that were loaded come back loaded instantly
    setSetlistSongs(sl.songs.map(s => ({
      ...s,
      status: s.data ? 'loaded' : 'pending',
    })));
    setView('setlist');
  }

  function newSetlist() {
    // Suggest a name based on the next Sunday date
    const today = new Date();
    const day = today.getDay();
    const daysUntilSunday = day === 0 ? 7 : 7 - day;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    const suggested = nextSunday.toLocaleDateString('en-US', { month:'short', day:'numeric' }) + ' Sunday';
    setSetlistName(suggested);
    setSetlistSongs([]);
    setView('setlist');
  }

  const allLoaded = setlistSongs.length > 0 && setlistSongs.every(s => s.status === 'loaded');
  const anyLoading = setlistSongs.some(s => s.status === 'loading');
  const loadedCount = setlistSongs.filter(s => s.status === 'loaded').length;

  return (
    <>
      <style>{styles}</style>

      {/* ── Splash screen ── */}
      {showSplash && (
        <div style={{
          position:'fixed', inset:0, background:'#0C0B0A', zIndex:9999,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          gap:14, animation:'splashFade 2.4s ease forwards',
          fontFamily:"'Sora', sans-serif",
        }}>
          <div style={{
            width:68, height:68, background:'#e8c170', borderRadius:18,
            display:'flex', alignItems:'center', justifyContent:'center',
            animation:'iconPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both',
          }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="#0f0f0f">
              <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 3a1 1 0 0 1 1 1v6.17A3 3 0 1 1 9 16V7a1 1 0 0 1 1-1h2zm-2 11a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"/>
            </svg>
          </div>
          <div style={{
            fontSize:42, fontWeight:700, letterSpacing:10,
            color:'#fff', lineHeight:1,
            animation:'fadeUp 0.4s ease 0.6s both',
          }}>SELAH</div>
          <div style={{
            fontSize:10, color:'rgba(255,255,255,0.3)',
            letterSpacing:'0.16em', textTransform:'uppercase',
            animation:'fadeUp 0.4s ease 0.85s both',
          }}>Fuse Apps · by TNT Labs</div>
        </div>
      )}

      {stageOpen && <StageMode setlistName={setlistName} songs={setlistSongs} onExit={() => setStageOpen(false)} />}

      <div className="app">
        <div className="nav-bar">
          <div className="nav-logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 3a1 1 0 0 1 1 1v6.17A3 3 0 1 1 9 16V7a1 1 0 0 1 1-1h2zm-2 11a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"/></svg>
            </div>
            <span className="nav-title">Selah</span>
          </div>
          <div className="nav-tabs">
            <button className={`nav-tab${view==='services'?' active':''}`} onClick={() => setView('services')}>Services</button>
            <button className={`nav-tab${view==='search'?' active':''}`} onClick={() => setView('search')}>Search</button>
            <button className={`nav-tab${view==='library'?' active':''}`} onClick={() => setView('library')}>Library{library.length > 0 ? ` (${library.length})` : ''}</button>
            <button className={`nav-tab${view==='setlist'?' active':''}`} onClick={() => setView('setlist')}>Setlist{setlistSongs.length > 0 ? ` (${setlistSongs.length})` : ''}</button>
          </div>
        </div>

        {/* ── SERVICES (Planning Center) ── */}
        {view === 'services' && <ServicesView onAddToSetlist={addToSetlistFromPCO} />}

        {/* ── SEARCH ── */}
        {view === 'search' && (
          <>
            <div className="search-section">
              <div className="input-row">
                <div className="input-group">
                  <div className="field-label">Song title</div>
                  <input className="text-input" type="text" placeholder="Way Maker" value={songTitle} onChange={e=>setSongTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch(songTitle,songArtist)} />
                </div>
                <div className="input-group">
                  <div className="field-label">Artist</div>
                  <input className="text-input" type="text" placeholder="Sinach" value={songArtist} onChange={e=>setSongArtist(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch(songTitle,songArtist)} />
                </div>
              </div>
              <div style={{ display:'flex', gap:6, marginBottom:2 }}>
                <button className="btn-primary" style={{ flex:1 }} onClick={() => doSearch(songTitle, songArtist)} disabled={loading || !songTitle.trim()}>
                  {loading ? 'Loading…' : 'Look up chart ↗'}
                </button>
                {songData && !isInLibrary && <button className="btn-ghost" onClick={saveToLibrary}>★ Save</button>}
                {songData && isInLibrary && <button className="btn-ghost" style={{ color:'var(--accent)', borderColor:'var(--accent)' }} disabled>★ Saved</button>}
                {songData && (
                  <button className="btn-ghost" onClick={() => {
                    setSetlistSongs(p => {
                      if (p.some(s=>s.title===songData.title&&s.artist===songData.artist)) return p;
                      return [...p, { title:songData.title, artist:songData.artist, status:'loaded', data:songData }];
                    });
                    setView('setlist');
                  }}>+ List</button>
                )}
              </div>
              <div className="suggestions-row">
                {SUGGESTIONS.map(s => <div key={s.title} className="chip" onClick={() => quickSearch(s)}>{s.title}</div>)}
              </div>
            </div>
            {loading && <div className="loading-screen"><div className="loading-spinner" /><div className="loading-text">Building bass chart…</div><div className="loading-sub">{songTitle}{songArtist ? ` · ${songArtist}` : ''}</div></div>}
            {error && !loading && <div className="error-card">{error}</div>}
            {songData && !loading && (
              <div className="song-card">
                <div className="song-card-header">
                  <div><div className="song-title">{songData.title}</div><div className="song-artist">{songData.artist}</div></div>
                </div>
                <ChartContent data={songData} transpose={transpose} onTransposeChange={setTranspose} showTransport={true} />
              </div>
            )}
            {!songData && !loading && !error && (
              <div className="empty-state">
                <div className="empty-icon">🎸</div>
                <div className="empty-title">Ready to practice</div>
                <div className="empty-sub">Search any worship song, or tap a chip to get started.</div>
              </div>
            )}
          </>
        )}

        {/* ── LIBRARY ── */}
        {view === 'library' && (
          <div className="library-view">
            <div className="library-label">My song library ({library.length})</div>
            {library.length === 0 ? (
              <div className="library-empty"><div style={{ fontSize:28, marginBottom:10 }}>📚</div>No songs saved yet.<br />Search a song and hit <strong>★ Save</strong>.</div>
            ) : (
              <div className="library-items">
                {library.map(song => (
                  <div key={song.title+song.artist} className="library-item" onClick={() => loadFromLibrary(song)}>
                    <div style={{ fontSize:15, color:'var(--accent)', flexShrink:0 }}>★</div>
                    <div className="library-item-info">
                      <div className="library-item-title">{song.title}</div>
                      <div className="library-item-sub">{song.artist} · Key: {song.key} · ♩{song.bpm}</div>
                    </div>
                    <div className="library-item-actions" onClick={e=>e.stopPropagation()}>
                      <button className="lib-btn" onClick={() => addToSetlistFromLibrary(song)}>+ Setlist</button>
                      <button className="lib-btn" onClick={() => removeFromLibrary(song.title, song.artist)}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SETLIST ── */}
        {view === 'setlist' && (
          <div className="setlist-view">
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <input className="setlist-name-input" style={{ marginBottom:0, flex:1 }} value={setlistName} onChange={e=>setSetlistName(e.target.value)} placeholder="Setlist name e.g. Apr 6 Sunday" />
              <button className="btn-ghost" style={{ fontSize:12, padding:'7px 10px', flexShrink:0 }} onClick={newSetlist}>+ New</button>
            </div>
            <div className="add-song-area">
              <div className="add-area-label">Add song manually</div>
              <div className="add-song-row">
                <input className="text-input" type="text" placeholder="Song title" value={addTitle} onChange={e=>setAddTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addToSetlist()} style={{ flex:2 }} />
                <input className="text-input" type="text" placeholder="Artist" value={addArtist} onChange={e=>setAddArtist(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addToSetlist()} style={{ flex:1.5 }} />
                <button className="add-btn" onClick={addToSetlist} disabled={!addTitle.trim()}>+ Add</button>
              </div>
            </div>
            {setlistSongs.length === 0 ? (
              <div className="setlist-empty"><div style={{ fontSize:26, marginBottom:8 }}>📋</div>Add songs manually above, from your Library,<br />or import from the Services tab.</div>
            ) : (
              <div className="setlist-items" ref={listRef} onTouchMove={onTouchHandleMove} onTouchEnd={onTouchHandleEnd}>
                {setlistSongs.map((song, i) => {
                  const isDragging = draggingIdx === i || touchDragIdx.current === i;
                  const isOver = dragOverVisual === i || touchOverIdx === i;
                  return (
                    <div
                      key={i}
                      data-setlist-idx={i}
                      className={`setlist-item ${song.status}`}
                      draggable
                      onDragStart={() => onDragStart(i)}
                      onDragOver={e => onDragOver(e, i)}
                      onDragEnd={onDragEnd}
                      onDrop={() => onDrop(i)}
                      style={{
                        opacity: isDragging ? 0.4 : 1,
                        borderColor: isOver && !isDragging ? 'var(--accent)' : undefined,
                        transform: isOver && !isDragging ? 'scale(1.01)' : 'scale(1)',
                        transition: 'opacity 0.15s, transform 0.15s, border-color 0.15s',
                      }}
                    >
                      <div
                        className="item-drag-handle"
                        onTouchStart={e => onTouchHandleStart(e, i)}
                        style={{ cursor: touchDragActive ? 'grabbing' : 'grab' }}
                      >☰</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:1, flexShrink:0 }}>
                        <button
                          onClick={() => { if (i === 0) return; setSetlistSongs(p => { const a=[...p]; [a[i-1],a[i]]=[a[i],a[i-1]]; return a; }); }}
                          disabled={i === 0}
                          style={{ background:'none', border:'none', color:'var(--text3)', fontSize:10, cursor:'pointer', padding:'1px 3px', lineHeight:1, opacity: i===0?0.2:1 }}
                        >▲</button>
                        <button
                          onClick={() => { if (i === setlistSongs.length-1) return; setSetlistSongs(p => { const a=[...p]; [a[i],a[i+1]]=[a[i+1],a[i]]; return a; }); }}
                          disabled={i === setlistSongs.length - 1}
                          style={{ background:'none', border:'none', color:'var(--text3)', fontSize:10, cursor:'pointer', padding:'1px 3px', lineHeight:1, opacity: i===setlistSongs.length-1?0.2:1 }}
                        >▼</button>
                      </div>
                      <div className="item-num">{i+1}</div>
                      <div className="item-info">
                        <div className="item-title">{song.title}</div>
                        <div className="item-sub">{song.artist || '—'}{song.data ? ` · ${song.data.key} · ♩${song.data.bpm}` : song.pcoKey ? ` · Key: ${song.pcoKey} (PCO)` : ''}</div>
                        {song.status === 'error' && <div style={{ fontSize:11, color:'var(--red)', marginTop:1 }}>Load failed</div>}
                      </div>
                      <div className={`status-dot ${song.status==='loaded'?'loaded':song.status==='loading'?'loading':song.status==='error'?'error':'pending'}`} />
                      {(song.status === 'pending' || song.status === 'error') && (
                        <button className="item-load-btn" onClick={() => loadSongAt(i)}>{song.status==='error'?'Retry':'Load'}</button>
                      )}
                      <button className="item-del" onClick={() => removeSong(i)}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
            {setlistSongs.length > 0 && (
              <>
                <div className="setlist-footer">
                  <button className="load-all-btn" onClick={loadAll} disabled={anyLoading || allLoaded}>
                    {anyLoading ? 'Loading…' : allLoaded ? `✓ All ${setlistSongs.length} loaded` : `Load all (${setlistSongs.length - loadedCount} left)`}
                  </button>
                  <button className="stage-btn" onClick={() => { if (loadedCount === 0) { alert('Load at least one chart first.'); return; } setStageOpen(true); }} disabled={loadedCount === 0}>
                    Go on stage →
                  </button>
                </div>
                <div style={{ marginTop:8 }}>
                  <button className="btn-ghost" style={{ width:'100%' }} onClick={() => { saveSetlist(); }}>
                    {savedSetlists.some(s => s.name === setlistName) ? `↑ Update "${setlistName}"` : `Save as "${setlistName}"`}
                  </button>
                </div>
              </>
            )}
            {savedSetlists.length > 0 && (
              <div className="saved-setlists">
                <div className="saved-label">Saved setlists ({savedSetlists.length})</div>
                {savedSetlists.map(sl => {
                  const loadedSongs = sl.songs.filter(s => s.data).length;
                  return (
                    <div key={sl.id} className="saved-item" onClick={() => loadSaved(sl)}>
                      <div className="saved-item-info">
                        <div className="saved-item-name">{sl.name}</div>
                        <div className="saved-item-meta">
                          {sl.songs.length} songs
                          {loadedSongs > 0 && <span style={{ color:'var(--green)', marginLeft:6 }}>· {loadedSongs} charts ready</span>}
                          {' · '}{sl.date}
                        </div>
                      </div>
                      <button className="saved-item-del" onClick={e=>{ e.stopPropagation(); setSavedSetlists(p=>p.filter(x=>x.id!==sl.id)); }}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>
          <div style={{
            width:16, height:16, background:'#1a1a1a', border:'1px solid rgba(255,255,255,0.12)',
            borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
              <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 3a1 1 0 0 1 1 1v6.17A3 3 0 1 1 9 16V7a1 1 0 0 1 1-1h2zm-2 11a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"/>
            </svg>
          </div>
          <span style={{ fontFamily:"'Sora',sans-serif", fontSize:10, color:'rgba(255,255,255,0.2)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Fuse Apps</span>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.1)' }}>·</span>
          <span style={{ fontFamily:"'Sora',sans-serif", fontSize:10, color:'rgba(255,255,255,0.15)', letterSpacing:'0.05em' }}>by TNT Labs</span>
        </div>

      </div>
    </>
  );
}
