// Prefer dictionary-recorded audio; fall back to a selected English system voice.
// Free Dictionary API: https://dictionaryapi.dev/ (requires internet access).
const KEY = 'vocabulary-voice-preference-v1';
const synth = window.speechSynthesis;
const cache = new Map();
let audio = null;
let pending = null;
let requestId = 0;

export function getEnglishVoices() {
  if (!synth || !('SpeechSynthesisUtterance' in window)) return [];
  return synth.getVoices().filter(v => /^en(?:[-_]|$)/i.test(v.lang))
    .sort((a,b) => Number(/^en[-_]US$/i.test(b.lang)) - Number(/^en[-_]US$/i.test(a.lang)) || a.name.localeCompare(b.name));
}
export function getVoicePreference() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}
export function setVoicePreference(id) {
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch {}
}
function chooseVoice(voices) {
  const saved = getVoicePreference();
  const chosen = voices.find(v => `${v.name}|${v.lang}` === saved);
  if (chosen) return chosen;
  const us = voices.filter(v => /^en[-_]US$/i.test(v.lang));
  const list = us.length ? us : voices;
  for (const pattern of [/^Ava(?: \(Enhanced\))?$/i, /^Samantha(?: \(Enhanced\))?$/i, /^Allison$/i, /^Zoe$/i, /Google US English/i]) {
    const found = list.find(v => pattern.test(v.name));
    if (found) return found;
  }
  return list[0] || null;
}
function stopPrevious() {
  requestId++;
  if (audio) { audio.pause(); audio.currentTime = 0; audio = null; }
  if (synth) synth.cancel();
}
function systemSpeak(content, rate) {
  if (!synth || !('SpeechSynthesisUtterance' in window)) throw new Error('目前瀏覽器不支援語音發音。');
  const voice = chooseVoice(getEnglishVoices());
  if (!voice) throw new Error('沒有可用的英文語音，請確認網路或系統語音設定。');
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = Math.min(1.15, Math.max(0.75, Number(rate) || 0.95));
  utterance.pitch = 1;
  utterance.volume = 1;
  pending = utterance;
  utterance.onend = utterance.onerror = () => { if (pending === utterance) pending = null; };
  synth.speak(utterance);
  if (synth.paused) synth.resume();
}
async function dictionaryAudio(word) {
  const key = word.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
  if (!response.ok) throw new Error('字典未收錄');
  const entries = await response.json();
  const phonetics = entries.flatMap(entry => entry.phonetics || []);
  const candidates = phonetics.map(p => p.audio).filter(url => typeof url === 'string' && /^https:\/\//.test(url));
  const selected = candidates.find(url => /-us\.(mp3|ogg)(?:\?|$)/i.test(url)) || candidates[0] || null;
  cache.set(key, selected);
  return selected;
}
export function speak(text, rate = 0.95) {
  const content = String(text ?? '').trim();
  if (!content) return;
  stopPrevious();
  const token = requestId;
  // Dictionary recordings generally cover individual words, not sentences or phrases.
  if (!/^[a-z]+(?:['’-][a-z]+)*$/i.test(content)) {
    systemSpeak(content, rate);
    return;
  }
  // Keep failures internal so existing app.js callers need no async changes.
  dictionaryAudio(content).then(async url => {
    if (token !== requestId) return;
    if (!url) { systemSpeak(content, rate); return; }
    const player = new Audio(url);
    player.preload = 'auto';
    player.playbackRate = 1; // recorded speech at natural speed
    audio = player;
    try { await player.play(); }
    catch { if (token === requestId) systemSpeak(content, rate); }
  }).catch(() => { if (token === requestId) systemSpeak(content, rate); });
}
