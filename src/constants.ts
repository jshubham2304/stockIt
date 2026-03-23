import { Car, Accessory } from './types';

export const INITIAL_CARS: Car[] = [
  { id: 'car-1', name: 'Creta', createdAt: Date.now() },
  { id: 'car-2', name: 'Nexon', createdAt: Date.now() },
];

export const INITIAL_ACCESSORIES: Accessory[] = [
  // Creta
  { id: 'acc-1', carId: 'car-1', name: 'Door Visor', stock: 6, updatedAt: Date.now() },
  { id: 'acc-2', carId: 'car-1', name: '7D Mats', stock: 4, updatedAt: Date.now() },
  { id: 'acc-3', carId: 'car-1', name: '3D Mats', stock: 5, updatedAt: Date.now() },
  { id: 'acc-4', carId: 'car-1', name: 'SLF', stock: 8, updatedAt: Date.now() },
  // Nexon
  { id: 'acc-5', carId: 'car-2', name: 'Door Visor', stock: 4, updatedAt: Date.now() },
  { id: 'acc-6', carId: 'car-2', name: '3D Mats', stock: 7, updatedAt: Date.now() },
  { id: 'acc-7', carId: 'car-2', name: '7D Mats', stock: 6, updatedAt: Date.now() },
  { id: 'acc-8', carId: 'car-2', name: 'SLF', stock: 11, updatedAt: Date.now() },
];
