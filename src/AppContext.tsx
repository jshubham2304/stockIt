import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { AppState, AppAction, Role, Car, Accessory } from './types';
import { db, OperationType, handleFirestoreError } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const STORAGE_KEY_PREFS = 'car_stock_pro_prefs';

const initialState: AppState = {
  cars: [],
  accessories: [],
  backups: [],
  role: 'USER',
  darkMode: false,
  isAuthReady: false,
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  undo: () => void;
  canUndo: boolean;
} | null>(null);

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_ROLE':
      return { ...state, role: action.payload };
    case 'TOGGLE_DARK_MODE':
      return { ...state, darkMode: !state.darkMode };
    case 'SET_DATA':
      return { ...state, ...action.payload, isAuthReady: true };
    case 'SET_BACKUPS':
      return { ...state, backups: action.payload, isAuthReady: true };
    case 'RESET_DATA':
      return state;
    case 'UNDO':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const historyRef = useRef<AppState[]>([]);

  // Load preferences
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFS);
    if (saved) {
      const { role, darkMode } = JSON.parse(saved);
      dispatch({ type: 'SET_DATA', payload: { role, darkMode } });
    }
  }, []);

  // Save preferences
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify({
      role: state.role,
      darkMode: state.darkMode
    }));
  }, [state.role, state.darkMode]);

  // Firestore Listeners
  useEffect(() => {
    const unsubCars = onSnapshot(collection(db, 'cars'), (snapshot) => {
      const cars = snapshot.docs.map(doc => doc.data() as Car);
      dispatch({ type: 'SET_DATA', payload: { cars } });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'cars'));

    const unsubAccessories = onSnapshot(collection(db, 'accessories'), (snapshot) => {
      const accessories = snapshot.docs.map(doc => doc.data() as Accessory);
      dispatch({ type: 'SET_DATA', payload: { accessories } });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'accessories'));

    const unsubBackups = onSnapshot(collection(db, 'backups'), (snapshot) => {
      const backups = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
      dispatch({ type: 'SET_BACKUPS', payload: backups });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'backups'));

    return () => {
      unsubCars();
      unsubAccessories();
      unsubBackups();
    };
  }, []);

  const undo = () => {
    if (historyRef.current.length > 1) {
      const previousState = historyRef.current[historyRef.current.length - 2];
      historyRef.current.pop();
      dispatch({ type: 'UNDO', payload: previousState });
    }
  };

  return (
    <AppContext.Provider value={{ state, dispatch, undo, canUndo: historyRef.current.length > 1 }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
