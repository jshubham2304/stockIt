export type Role = 'ADMIN' | 'USER';

export interface Car {
  id: string;
  name: string;
  createdAt: number;
}

export interface Accessory {
  id: string;
  carId: string;
  name: string;
  stock: number;
  updatedAt: number;
  updatedBy?: string;
}

export interface Backup {
  id: string;
  type: 'CAR' | 'ACCESSORY';
  data: any;
  deletedAt: number;
}

export interface AppState {
  cars: Car[];
  accessories: Accessory[];
  backups: Backup[];
  role: Role;
  darkMode: boolean;
  isAuthReady: boolean;
}

export type AppAction =
  | { type: 'SET_ROLE'; payload: Role }
  | { type: 'TOGGLE_DARK_MODE' }
  | { type: 'ADD_CAR'; payload: Car }
  | { type: 'DELETE_CAR'; payload: string }
  | { type: 'ADD_ACCESSORY'; payload: Accessory }
  | { type: 'DELETE_ACCESSORY'; payload: string }
  | { type: 'UPDATE_ACCESSORY'; payload: Partial<Accessory> & { id: string } }
  | { type: 'SET_DATA'; payload: Partial<AppState> }
  | { type: 'RESET_DATA' }
  | { type: 'UNDO'; payload: AppState }
  | { type: 'SET_BACKUPS'; payload: Backup[] };
