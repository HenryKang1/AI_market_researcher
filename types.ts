export enum QuestionType {
  OPEN_ENDED = 'OPEN_ENDED',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  RATING_SCALE = 'RATING_SCALE' // 1-5
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[]; // For Multiple Choice
}

export interface Survey {
  title: string;
  description: string;
  questions: Question[];
}

export interface TargetPersonaDefinition {
  description: string; // e.g., "Busy moms in their 30s interested in fitness"
  count: number; // Number of personas to generate
}

export interface GeneratedPersona {
  id: string;
  name: string;
  age: number;
  occupation: string;
  traits: string; // Personality traits
  painPoints: string;
}

export interface SurveyResponse {
  personaId: string;
  answers: {
    questionId: string;
    answer: string | number;
  }[];
}

export interface AnalysisResult {
  summary: string;
  keyInsights: string[];
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  featureSuggestions: string[];
}

export type Step = 'SETUP' | 'PERSONAS' | 'SIMULATION' | 'RESULTS';