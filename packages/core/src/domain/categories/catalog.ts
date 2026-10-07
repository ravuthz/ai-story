import type { CategoryDefinition } from "./Category";

/**
 * Seed pools per category. The cartesian product of the pools is the space of
 * unique blueprints: 10 × 10 × 10 × 10 × 4 = 40,000 combinations per category.
 */
export const CATALOG: CategoryDefinition[] = [
  {
    id: "horror-story",
    label: "Horror Story",
    description: "Chilling tales of the unknown, haunted places and dark secrets.",
    imageStyle: "dark cinematic horror, moody fog, low-key lighting, film grain",
    pools: {
      themes: ["a cursed heirloom", "a vanishing village", "a whispering well", "a mirror that remembers", "a forbidden ritual", "a ghost seeking justice", "an endless night", "a doll that moves", "a voice on the radio", "a debt owed to the dead"],
      settings: ["an abandoned rubber plantation", "a flooded temple", "a night bus on a mountain road", "an old colonial hospital", "a rice field under a blood moon", "a boarding school dormitory", "a riverside stilt house", "a closed night market", "a lighthouse in a storm", "a hotel with no thirteenth floor"],
      protagonists: ["a skeptical journalist", "a night-shift nurse", "a young monk", "a taxi driver", "a curious schoolgirl", "a grieving widower", "a ghost hunter streamer", "a fisherman", "a security guard", "an antique dealer"],
      twists: ["the narrator was dead all along", "the ghost was trying to warn them", "the village never existed", "the curse passes to whoever listens", "the hunter becomes the haunted", "the real monster is human", "time loops at midnight", "the house is alive", "the photo shows one extra person", "the protector is the predator"],
      tones: ["slow-burn dread", "psychological", "folk horror", "jump-scare thriller"],
    },
  },
  {
    id: "love-story",
    label: "Love Story",
    description: "Romance, longing and the many shapes of love.",
    imageStyle: "soft romantic cinematic, golden hour, warm bokeh, pastel tones",
    pools: {
      themes: ["love across social classes", "second chance romance", "letters never sent", "love after loss", "a promise made in childhood", "an arranged meeting turned real", "long-distance devotion", "love in wartime", "a love that must stay secret", "falling for a rival"],
      settings: ["a Phnom Penh rooftop café", "a seaside town in Kep", "a university library", "a monsoon-soaked street", "a Siem Reap guesthouse", "a train across the countryside", "a flower market at dawn", "a small bakery", "a wedding where they are guests", "a hospital waiting room"],
      protagonists: ["a shy street artist", "a busy young doctor", "a tuk-tuk driver with big dreams", "a returning overseas student", "a widowed bookstore owner", "a famous singer in disguise", "a farmer's daughter", "a lonely programmer", "a wedding photographer", "a pastry chef"],
      twists: ["they had met years ago", "the rival was the secret admirer", "the letters were written by someone else", "one of them is leaving forever", "the matchmaker falls in love", "the stranger is a childhood friend", "love blooms after a misunderstanding", "they choose friendship over romance", "a lost item reunites them", "the ending is bittersweet but hopeful"],
      tones: ["heartwarming", "bittersweet", "playful", "dramatic"],
    },
  },
  {
    id: "motivation",
    label: "Motivation",
    description: "Stories of grit, discipline and rising after failure.",
    imageStyle: "epic inspirational cinematic, sunrise light, wide shots, vibrant",
    pools: {
      themes: ["discipline over talent", "failing forward", "small daily habits", "courage to start", "patience and long-term thinking", "overcoming fear of judgment", "resilience after loss", "learning from a mentor", "turning pain into purpose", "consistency beats intensity"],
      settings: ["a village school with no electricity", "a crowded city market", "a boxing gym", "a mountain trail", "a small startup office", "a farm during drought", "a night-time study desk", "a construction site", "a hospital rehab center", "a marathon finish line"],
      protagonists: ["a street vendor", "a student who failed exams", "an injured athlete", "a single mother", "a factory worker learning to code", "an elderly beginner", "a rejected musician", "a stuttering speaker", "a small-business owner", "a garbage collector's son"],
      twists: ["the setback was the turning point", "the mentor was once a failure", "the goal changes but growth remains", "success comes from helping others", "the critic becomes the supporter", "the real win is self-respect", "progress was invisible until it wasn't", "they inspire the next generation", "losing the competition wins a bigger prize", "the habit outlives the motivation"],
      tones: ["intense", "calm and reflective", "uplifting", "raw and honest"],
    },
  },
  {
    id: "philosophy",
    label: "Philosophy",
    description: "Reflective parables about meaning, mind and existence.",
    imageStyle: "minimalist surreal, contemplative, muted palette, symbolic composition",
    pools: {
      themes: ["impermanence", "the nature of happiness", "freedom and responsibility", "the self and the ego", "suffering and acceptance", "time and mortality", "truth versus belief", "desire and contentment", "justice and fairness", "the meaning of work"],
      settings: ["a monastery at dawn", "a quiet ferry crossing", "an empty classroom", "a busy intersection", "a garden of stones", "a desert crossroads", "a city rooftop at night", "a library with infinite rooms", "a river that never ends", "a waiting room"],
      protagonists: ["an old teacher and a student", "a wandering monk", "a merchant", "a king who has everything", "a child asking why", "a philosopher in a market", "a prisoner", "a clockmaker", "a ferryman", "an AI learning to wonder"],
      twists: ["the question was the answer", "the teacher learns from the student", "letting go brings what was sought", "the enemy reflects the self", "the treasure was ordinary life", "nothing changed except perception", "the end is a beginning", "silence speaks louder than argument", "both sides were right", "the journey was a circle"],
      tones: ["stoic", "zen", "existential", "socratic dialogue"],
    },
  },
  {
    id: "quotes",
    label: "Quotes",
    description: "Short scenes built around powerful original quotes.",
    imageStyle: "elegant cinematic typography backdrop, atmospheric, clean negative space",
    pools: {
      themes: ["self-worth", "kindness", "perseverance", "gratitude", "change", "silence and listening", "friendship", "dreams", "humility", "forgiveness"],
      settings: ["sunrise over Angkor Wat", "a rainy window", "an ocean horizon", "a forest path", "a candle in darkness", "a mountain summit", "a city at night", "a field of lotus flowers", "an old wooden bridge", "a starry sky"],
      protagonists: ["a grandparent's advice", "a stranger's note", "a teacher's last lesson", "an athlete's mantra", "a monk's teaching", "a parent's letter", "a friend's reminder", "a traveller's journal", "a child's wisdom", "an inner voice"],
      twists: ["the quote is understood only later", "the words change a decision", "the quote is passed on", "the meaning flips at the end", "the quote was self-written", "it ends with a question", "a simple word carries weight", "the opposite is also true", "it applies to the speaker", "it becomes a daily ritual"],
      tones: ["poetic", "powerful", "gentle", "witty"],
    },
  },
  {
    id: "folklore",
    label: "Folklore",
    description: "Khmer and Southeast Asian legends, myths and fables retold.",
    imageStyle: "traditional Khmer painting style, ornate, temple murals, rich golds and reds",
    pools: {
      themes: ["a clever hare outwitting the strong", "the origin of a river", "a naga princess", "a hermit's magic", "a giant and a prince", "a greedy king's punishment", "a loyal servant", "a magical fruit tree", "the moon's rabbit", "a buried treasure guarded by spirits"],
      settings: ["the ancient kingdom of Angkor", "the Tonle Sap lake", "a sacred forest", "a royal palace", "a hermit's cave", "the Mekong riverbank", "a village of potters", "the Cardamom mountains", "an island of spirits", "a crossroads shrine"],
      protagonists: ["Judge Rabbit", "a poor woodcutter", "a brave princess", "an orphan boy", "a wise elder", "a trickster crocodile", "a mischievous monkey", "a humble farmer", "a powerful sorcerer", "a celestial maiden"],
      twists: ["wit defeats strength", "the reward is wisdom, not gold", "the villain is redeemed", "a landmark is born", "the humble become royal", "greed turns to stone", "kindness to animals returns", "the curse breaks with truth", "the gift was a test", "a festival begins from this tale"],
      tones: ["fable with a moral", "epic legend", "humorous trickster tale", "mystical"],
    },
  },
  {
    id: "kid-story",
    label: "Kid Story",
    description: "Gentle, colourful bedtime stories for children.",
    imageStyle: "cute children's book illustration, soft watercolor, bright friendly colors",
    pools: {
      themes: ["sharing with friends", "being brave at night", "telling the truth", "trying new food", "helping at home", "making a new friend", "being kind to animals", "learning to say sorry", "patience", "caring for nature"],
      settings: ["a magical treehouse", "a busy farm", "an underwater kingdom", "a rainbow forest", "a classroom of animals", "a cloud village", "a toy shop at night", "a garden of giant vegetables", "a starship", "grandma's kitchen"],
      protagonists: ["a little elephant", "a curious girl named Srey", "a sleepy panda", "a tiny robot", "a brave boy named Dara", "a shy turtle", "a chatty parrot", "a lost baby duck", "a dragon who is afraid of fire", "a kitten who wants to fly"],
      twists: ["the monster was just lonely", "the smallest one saves the day", "the mistake becomes a lesson", "everyone helps together", "the gift was friendship", "the adventure was a dream", "the problem solves itself with patience", "the shy one becomes the leader", "the lost thing was there all along", "they teach the grown-ups"],
      tones: ["cozy bedtime", "silly and funny", "adventurous", "musical and rhyming"],
    },
  },
];
