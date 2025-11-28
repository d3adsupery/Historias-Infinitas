export interface GameState {
  hp: number;
  inventory: string[];
  history: GameTurn[];
  isGameOver: boolean;
  theme: string;
}

export interface GameTurn {
  text: string;
  imageUrl?: string;
  choices: Choice[];
}

export interface Choice {
  id: string;
  text: string;
}

// Structured response expected from the Text AI
export interface StoryEngineResponse {
  narrative: string; // The story text
  hpChange: number; // e.g., -10, +5, 0
  inventoryAdd: string[]; // Items found
  inventoryRemove: string[]; // Items used/lost
  visualDescription: string; // Prompt for the image generator
  isGameOver: boolean;
  choices: {
    id: string;
    text: string;
  }[];
}
