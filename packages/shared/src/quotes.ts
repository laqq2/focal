export const MOTIVATIONAL_QUOTES: string[] = [
  "Small steps every day lead to big changes.",
  "Focus is saying no to a thousand good ideas.",
  "The future depends on what you do today.",
  "Discipline is choosing what you want most over what you want now.",
  "Progress, not perfection.",
  "Energy flows where attention goes.",
  "You do not rise to the level of your goals; you fall to the level of your systems.",
  "One hour of focused work beats eight hours of distracted effort.",
  "Start where you are. Use what you have. Do what you can.",
  "Consistency compounds.",
  "Deep work is a superpower in a distracted world.",
  "Your attention is your most valuable asset—spend it wisely.",
  "Clarity comes from engagement, not thought.",
  "Ship the work. Iterate later.",
  "Courage is not the absence of fear, but action in spite of it.",
  "The best time to plant a tree was twenty years ago. The second best time is now.",
  "You become what you repeatedly do.",
  "Show up, even when motivation is missing.",
  "Let your habits whisper who you are becoming.",
  "Quiet the noise. Do the next right thing.",
];

export const STOIC_QUOTES: string[] = [
  "You have power over your mind—not outside events. Realize this, and you will find strength.",
  "Waste no more time arguing about what a good person should be. Be one.",
  "If it is endurable, then endure it. Stop complaining.",
  "He who fears death will never do anything worthy of a living person.",
  "No person has the power to have everything they want, but it is in their power not to want what they do not have.",
  "How long are you going to wait before you demand the best for yourself?",
  "We suffer more often in imagination than in reality.",
  "First say to yourself what you would be; then do what you have to do.",
  "The obstacle is the way.",
  "Be tolerant with others and strict with yourself.",
  "If a man knows not to which port he sails, no wind is favorable.",
  "It is not because things are difficult that we do not dare; it is because we do not dare that things are difficult.",
  "Receive without pride, let go without attachment.",
  "Do not indulge in dreams of having what you have not, but reckon up the chief treasures you already possess.",
  "No great thing is created suddenly.",
  "He who lives in harmony with himself lives in harmony with the universe.",
  "Choose not to be harmed—and you won’t feel harmed.",
  "The happiness of your life depends upon the quality of your thoughts.",
  "Look well into thyself; there is a source of strength which will always spring up if thou wilt always look.",
  "What stands in the way becomes the way.",
];

export function dayIndexUtc(date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.floor(diff / 86400000);
}

export function pickDailyQuote(
  style: "motivational" | "stoic" | "custom",
  customLines: string[] | null,
  date = new Date()
): string {
  const idx = dayIndexUtc(date);
  if (style === "custom" && customLines && customLines.length > 0) {
    return customLines[idx % customLines.length] ?? customLines[0] ?? "";
  }
  const pool = style === "stoic" ? STOIC_QUOTES : MOTIVATIONAL_QUOTES;
  return pool[idx % pool.length] ?? "";
}
