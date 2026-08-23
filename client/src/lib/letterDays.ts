/** The single curriculum order used by the menu, progression, and games. */
export const LETTER_DAY_GROUPS: readonly (readonly string[])[] = [
  ['m', 's', 'a'],
  ['i', 'o', 'b'],
  ['e', 'u', 't'],
  ['k', 'l', 'y'],
  ['n', 'g', 'p'],
  ['r', 'd', 'h'],
  ['w', 'c', 'f'],
  ['j', 'q', 'v'],
  ['x', 'z'],
];

export const MARUNGKO_ORDER = LETTER_DAY_GROUPS.flat();

export function getDayIndex(letter: string): number {
  return LETTER_DAY_GROUPS.findIndex(day => day.includes(letter.toLowerCase() as never));
}

export function getLettersForDay(letter: string): readonly string[] {
  const day = getDayIndex(letter);
  return day === -1 ? [] : LETTER_DAY_GROUPS[day];
}

export function isLastLetterOfDay(letter: string): boolean {
  const letters = getLettersForDay(letter);
  return letters[letters.length - 1] === letter.toLowerCase();
}

export function getPreviousDayLetters(letter: string): string[] {
  const day = getDayIndex(letter);
  return day > 0 ? LETTER_DAY_GROUPS.slice(0, day).flat() : [];
}
