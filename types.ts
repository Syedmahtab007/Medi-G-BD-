export type Role = 'user' | 'model';
export type Theme = 'black' | 'white' | 'pink';
export type ModelMode = 'fast' | 'standard' | 'thinking';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
  isError?: boolean;
  sources?: GroundingSource[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}