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

/** Christian theologians & saints; a single em dash before attribution (dashboard splits on the last em dash). */
export const THEOLOGY_QUOTES: string[] = [
  "Our heart is restless until it rests in you. — Augustine of Hippo",
  "Faith is to believe what you do not see; the reward of this faith is to see what you believe. — Augustine of Hippo",
  "To one who has faith, no explanation is necessary. To one without faith, no explanation is possible. — Thomas Aquinas",
  "Wonder is the desire for knowledge. — Thomas Aquinas",
  "I cannot and will not recant anything, for to go against conscience is neither right nor safe. Here I stand. — Martin Luther",
  "Even if I knew that tomorrow the world would go to pieces, I would still plant my apple tree. — Martin Luther",
  "We are not our own; let us therefore not live as if we were our own. — John Calvin",
  "There is not one blade of grass, there is no color in this world that is not intended to make us rejoice. — John Calvin",
  "What is impossible for mortals is possible for God. — Gospel of Luke",
  "God cannot give us a happiness and peace apart from himself, because it is not there. There is no such thing. — C. S. Lewis",
  "Humility is not thinking less of yourself, but thinking of yourself less. — C. S. Lewis",
  "Let nothing disturb you, nothing frighten you; all things are passing. God never changes. — Teresa of Ávila",
  "Christ has no body now but yours. No hands, no feet on earth but yours. Yours are the eyes through which he looks compassion on this world. — Teresa of Ávila",
  "When Christ calls a man, he bids him come and die. — Dietrich Bonhoeffer",
  "The first service one owes to others in the fellowship consists in listening to them. — Dietrich Bonhoeffer",
  "There is within every soul a thirst for happiness and meaning which no finite thing can ever assuage. — Blaise Pascal",
  "The heart has its reasons which reason knows nothing of. — Blaise Pascal",
  "God became man so that man might become God. — Irenaeus of Lyons",
  "The glory of God is man fully alive, and the life of man is the vision of God. — Irenaeus of Lyons",
  "Pray as though everything depended on God. Work as though everything depended on you. — Ignatius of Loyola",
  "Faith and reason are like two wings on which the human spirit rises to the contemplation of truth. — John Paul II",
  "Be not afraid of holiness. It will take away none of your energy, it will take away none of your joy, none of your fruitfulness. — John Paul II",
  "The Church is not a museum for saints but a hospital for sinners. — Augustine of Hippo",
  "All shall be well, and all shall be well, and all manner of thing shall be well. — Julian of Norwich",
  "I do not seek to understand that I may believe, but I believe in order to understand. — Anselm of Canterbury",
  "He who loses his life for my sake will find it. — Jesus Christ",
  "Come to me, all you that are weary and are carrying heavy burdens, and I will give you rest. — Jesus Christ",
  "The chief end of man is to glorify God and enjoy him forever. — Westminster Shorter Catechism",
  "God is that than which nothing greater can be conceived. — Anselm of Canterbury",
  "In Jesus Christ there is no isolation of man from God or of God from man. — Karl Barth",
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
  style: "motivational" | "stoic" | "theology" | "custom",
  customLines: string[] | null,
  date = new Date()
): string {
  const idx = dayIndexUtc(date);
  if (style === "custom" && customLines && customLines.length > 0) {
    return customLines[idx % customLines.length] ?? customLines[0] ?? "";
  }
  const pool =
    style === "stoic" ? STOIC_QUOTES : style === "theology" ? THEOLOGY_QUOTES : MOTIVATIONAL_QUOTES;
  return pool[idx % pool.length] ?? "";
}
