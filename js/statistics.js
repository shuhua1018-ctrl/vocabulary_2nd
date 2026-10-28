export function calculateStats(words, state) {
  const records = Object.values(state.words);
  const reviewed = records.filter(x => (x.srsCount || x.reviewCount || 0) > 0).length;
  const favorites = records.filter(x => x.favorite).length;
  const wrongWords = records.filter(x => (x.wrongCount || 0) > 0).length;
  const dueWords = records.filter(x => x.nextReviewAt && Date.parse(x.nextReviewAt) <= Date.now()).length;
  const correct = records.reduce((sum, x) => sum + (x.correctCount || 0), 0);
  const incorrect = records.reduce((sum, x) => sum + (x.wrongCount || 0), 0);
  const answered = correct + incorrect;
  return {
    totalWords: words.length, reviewed: Math.min(reviewed, words.length),
    unreviewed: Math.max(0, words.length - reviewed), favorites, wrongWords, dueWords,
    totalAnswered: answered, totalCorrect: correct,
    accuracy: answered ? Math.round(correct / answered * 100) : 0,
    sessions: state.sessions.length
  };
}
