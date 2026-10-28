export function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createChoiceQuestion(pool, mode = "choice", fixedAnswer = null) {
  if (!pool.length) throw new Error("此範圍沒有可測驗的單字。");
  const answer = fixedAnswer || pool[Math.floor(Math.random() * pool.length)];
  const answerText = mode === "listening" ? answer.word : answer.meaning;
  const getText = word => mode === "listening" ? word.word : word.meaning;
  const distractors = shuffle(pool.filter(w =>
    w.id !== answer.id && getText(w).trim() !== answerText.trim()
  ));
  const options = shuffle([answer, ...distractors.slice(0, 3)]);
  return { mode, wordId: answer.id, prompt: mode === "listening" ? "請播放發音，選出你聽到的單字。" : answer.word, options, answerId: answer.id };
}

export function checkSpelling(input, answer) {
  return input.trim().toLocaleLowerCase() === answer.trim().toLocaleLowerCase();
}

export function recordAnswer(state, wordId, correct) {
  const item = state.words[wordId] ??= {
    favorite: false, wrongCount: 0, correctCount: 0, reviewCount: 0,
    srs: { Again: 0, Hard: 0, Good: 0, Easy: 0 },
    lastReviewedAt: null, nextReviewAt: null, intervalDays: 0
  };
  item.quizCount = (item.quizCount || 0) + 1;
  item.lastAnsweredAt = new Date().toISOString();
  if (correct) item.correctCount = (item.correctCount || 0) + 1;
  else item.wrongCount = (item.wrongCount || 0) + 1;
  return item;
}

export function makeSession(mode, source, answers, startedAt) {
  const correct = answers.filter(a => a.correct).length;
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    mode, source, startedAt, finishedAt: new Date().toISOString(),
    total: answers.length, correct, wrong: answers.length - correct, answers
  };
}
