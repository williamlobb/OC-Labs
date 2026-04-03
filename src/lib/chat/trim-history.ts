/**
 * Trim a chat history array from the oldest end until the total character
 * count of all messages fits within `budget`. This prevents silently
 * overflowing the model's context window when history is long.
 */
export function trimHistoryToBudget(
  history: { role: string; content: string }[],
  budget: number
): { role: string; content: string }[] {
  let total = 0
  const kept: { role: string; content: string }[] = []
  for (let i = history.length - 1; i >= 0; i--) {
    total += history[i].content.length
    if (total > budget) break
    kept.unshift(history[i])
  }
  return kept
}
