// Mac + Chrome: choose and preview an installed English voice.
const KEY = 'vocabulary-voice-preference-v1';
const synth = window.speechSynthesis;
let pending = null;
const supported = () => !!synth && 'SpeechSynthesisUtterance' in window;

export function getEnglishVoices() {
  if (!supported()) return [];
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
  // Availability varies by macOS version. Never fall back to a non-English voice.
  for (const pattern of [/^Ava(?: \(Enhanced\))?$/i, /^Samantha(?: \(Enhanced\))?$/i, /^Allison$/i, /^Zoe$/i, /Google US English/i]) {
    const found = list.find(v => pattern.test(v.name));
    if (found) return found;
  }
  return list[0] || null;
}
export function speak(text, rate = 0.88) {
  if (!supported()) throw new Error('目前瀏覽器不支援語音發音。');
  const content = String(text ?? '').trim();
  if (!content) return;
  const voices = getEnglishVoices();
  const voice = chooseVoice(voices);
  if (!voice) throw new Error('尚未找到英文語音。請稍後重試，或在 Mac 系統設定中下載英文語音。');
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = Math.min(1.2, Math.max(0.65, Number(rate) || 0.88));
  utterance.pitch = 1;
  utterance.volume = 1;
  pending = utterance; // Keep a reference while Chrome speaks.
  utterance.onend = () => { if (pending === utterance) pending = null; };
  utterance.onerror = () => { if (pending === utterance) pending = null; };
  synth.speak(utterance);
  if (synth.paused) synth.resume();
}
