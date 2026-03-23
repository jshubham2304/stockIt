import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';
import { Plus, Minus, Trash2, Search, Car as CarIcon, ChevronRight, Settings, User as UserIcon, Moon, Sun, Undo, Download, LogOut, LogIn, History, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { INITIAL_CARS, INITIAL_ACCESSORIES } from './constants';

export default function App() {
  const { state, dispatch, undo, canUndo } = useApp();
  const [activeCarId, setActiveCarId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddCar, setShowAddCar] = useState(false);
  const [newCarName, setNewCarName] = useState('');
  const [addCarError, setAddCarError] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRestore, setShowRestore] = useState(false);

  const activeCar = state.cars.find(c => c.id === activeCarId);
  const filteredCars = state.cars.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!state.isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-pulse text-emerald-500 font-bold">Loading...</div>
      </div>
    );
  }

  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCarName.trim() || isSubmitting) return;
    if (state.cars.some(c => c.name.toLowerCase() === newCarName.toLowerCase())) {
        setAddCarError('Car name already exists');
        return;
    }
    setIsSubmitting(true);
    const id = crypto.randomUUID();
    try {
      await setDoc(doc(db, 'cars', id), { id, name: newCarName, createdAt: Date.now() });
      setNewCarName('');
      setShowAddCar(false);
      setAddCarError(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'cars');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCar = async (id: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const carToDelete = state.cars.find(c => c.id === id);
      if (!carToDelete) return;

      const batch = writeBatch(db);
      
      // Create backup for car
      const carBackupId = crypto.randomUUID();
      batch.set(doc(db, 'backups', carBackupId), {
        id: carBackupId,
        type: 'CAR',
        data: carToDelete,
        deletedAt: Date.now()
      });

      batch.delete(doc(db, 'cars', id));
      
      // Delete associated accessories and create backups
      const accs = state.accessories.filter(a => a.carId === id);
      accs.forEach(a => {
        const accBackupId = crypto.randomUUID();
        batch.set(doc(db, 'backups', accBackupId), {
          id: accBackupId,
          type: 'ACCESSORY',
          data: a,
          deletedAt: Date.now()
        });
        batch.delete(doc(db, 'accessories', a.id));
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'cars');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetData = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      // Delete all current data
      state.cars.forEach(c => batch.delete(doc(db, 'cars', c.id)));
      state.accessories.forEach(a => batch.delete(doc(db, 'accessories', a.id)));
      
      // Add initial data
      INITIAL_CARS.forEach(c => batch.set(doc(db, 'cars', c.id), c));
      INITIAL_ACCESSORIES.forEach(a => batch.set(doc(db, 'accessories', a.id), a));
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify({ cars: state.cars, accessories: state.accessories }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'car_stock_data.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300",
      state.darkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
    )}>
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-20 px-4 py-3 border-b backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3",
        state.darkMode ? "bg-zinc-900/80 border-zinc-800" : "bg-white/80 border-zinc-200"
      )}>
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-500/20">
              <CarIcon size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg tracking-tight">CarStock Pro</h1>
              <p className="hidden sm:block text-[10px] uppercase tracking-widest opacity-50 font-semibold">Inventory Management</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:hidden">
            <button 
              onClick={undo}
              disabled={!canUndo}
              className={cn(
                  "p-2 rounded-full transition-all",
                  !canUndo ? "opacity-20" : "hover:bg-zinc-200 dark:hover:bg-zinc-800"
              )}
            >
              <Undo size={18} />
            </button>
            <button 
              onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
              className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
            >
              {state.darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between w-full sm:w-auto gap-2">
          <div className="hidden sm:flex items-center gap-1">
            <button 
              onClick={undo}
              disabled={!canUndo}
              className={cn(
                  "p-2 rounded-full transition-all",
                  !canUndo ? "opacity-20" : "hover:bg-zinc-200 dark:hover:bg-zinc-800"
              )}
            >
              <Undo size={20} />
            </button>
            <button 
              onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
              className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
            >
              {state.darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setConfirmAction({
                title: 'Reset Data',
                message: 'Are you sure you want to reset all data to defaults? This cannot be undone.',
                onConfirm: () => { handleResetData(); setConfirmAction(null); }
              })}
              className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-all"
              title="Reset Data"
            >
              <Trash2 size={18} className="sm:w-5 sm:h-5" />
            </button>
            <button 
              onClick={exportData}
              className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
              title="Export Data"
            >
              <Download size={18} className="sm:w-5 sm:h-5" />
            </button>
            {state.role === 'ADMIN' && (
              <button 
                onClick={() => setShowRestore(true)}
                className={cn(
                  "p-2 rounded-full transition-all",
                  showRestore ? "bg-emerald-500 text-white" : "hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400"
                )}
                title="Restore Deleted Items"
              >
                <History size={18} className="sm:w-5 sm:h-5" />
              </button>
            )}
          </div>

          <div className={cn(
            "flex items-center gap-1 p-1 rounded-full border ml-auto sm:ml-0",
            state.darkMode ? "bg-zinc-800 border-zinc-700" : "bg-zinc-100 border-zinc-200"
          )}>
            <button 
              onClick={() => {
                if (state.role === 'USER') {
                  setShowPinModal(true);
                } else {
                  dispatch({ type: 'SET_ROLE', payload: 'ADMIN' });
                }
              }}
              className={cn(
                "px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-all",
                state.role === 'ADMIN' ? "bg-emerald-500 text-white shadow-sm" : "text-zinc-500"
              )}
            >
              Admin
            </button>
            <button 
              onClick={() => dispatch({ type: 'SET_ROLE', payload: 'USER' })}
              className={cn(
                "px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-all",
                state.role === 'USER' ? "bg-emerald-500 text-white shadow-sm" : "text-zinc-500"
              )}
            >
              User
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 pb-24">
        <AnimatePresence mode="wait">
          {showRestore ? (
            <RestoreScreen onBack={() => setShowRestore(false)} />
          ) : !activeCarId ? (
            <motion.div
              key="car-list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Search */}
              <div className="relative max-w-2xl mx-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  type="text"
                  placeholder="Search cars..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full pl-10 pr-4 py-3 rounded-2xl border transition-all outline-none focus:ring-2 focus:ring-emerald-500/20",
                    state.darkMode 
                      ? "bg-zinc-900 border-zinc-800 focus:border-emerald-500 text-white" 
                      : "bg-white border-zinc-200 focus:border-emerald-500 text-zinc-900"
                  )}
                />
              </div>

              {/* Car List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCars.map((car) => (
                  <motion.div
                    layoutId={car.id}
                    key={car.id}
                    onClick={() => setActiveCarId(car.id)}
                    className={cn(
                      "group p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] active:scale-95",
                      state.darkMode ? "bg-zinc-900 border-zinc-800 hover:border-zinc-700" : "bg-white border-zinc-200 hover:border-zinc-300"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-emerald-500">
                        <CarIcon size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{car.name}</h3>
                        <p className="text-xs opacity-50">
                          {state.accessories.filter(a => a.carId === car.id).length} Accessories
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {state.role === 'ADMIN' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmAction({
                              title: 'Delete Car',
                              message: `Are you sure you want to delete ${car.name} and all its accessories?`,
                              onConfirm: () => { handleDeleteCar(car.id); setConfirmAction(null); }
                            });
                          }}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      <ChevronRight className="text-zinc-300" />
                    </div>
                  </motion.div>
                ))}

                {filteredCars.length === 0 && (
                  <div className="py-12 text-center opacity-50">
                    <CarIcon size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No cars found</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <AccessoryScreen 
              car={activeCar!} 
              onBack={() => setActiveCarId(null)} 
            />
          )}
        </AnimatePresence>
      </main>

      {/* FAB for Add Car */}
      {!activeCarId && state.role === 'ADMIN' && (
        <button 
          onClick={() => setShowAddCar(true)}
          className="fixed bottom-8 right-8 w-14 h-14 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-500/40 flex items-center justify-center hover:scale-110 active:scale-90 transition-all z-20"
        >
          <Plus size={28} />
        </button>
      )}

      {/* Add Car Modal */}
      <AnimatePresence>
        {showAddCar && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddCar(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className={cn(
                "relative w-full max-w-md p-6 rounded-3xl shadow-2xl",
                state.darkMode ? "bg-zinc-900" : "bg-white"
              )}
            >
              <h2 className="text-xl font-bold mb-4">Add New Car</h2>
              <form onSubmit={handleAddCar} className="space-y-4">
                <input 
                  autoFocus
                  type="text"
                  placeholder="Car Name (e.g. Nexon)"
                  value={newCarName}
                  onChange={(e) => { setNewCarName(e.target.value); setAddCarError(null); }}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500/20",
                    state.darkMode ? "bg-zinc-800 border-zinc-700 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-900"
                  )}
                />
                {addCarError && <p className="text-red-500 text-xs font-medium">{addCarError}</p>}
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowAddCar(false)}
                    className="flex-1 py-3 rounded-xl font-medium opacity-50 hover:opacity-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Car'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmationModal 
        isOpen={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        onCancel={() => setConfirmAction(null)}
        darkMode={state.darkMode}
      />

      <PinModal 
        isOpen={showPinModal}
        onClose={() => { setShowPinModal(false); setPinError(false); }}
        onSuccess={() => {
          dispatch({ type: 'SET_ROLE', payload: 'ADMIN' });
          setShowPinModal(false);
          setPinError(false);
        }}
        error={pinError}
        setError={setPinError}
        darkMode={state.darkMode}
      />
    </div>
  );
}

function PinModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  error, 
  setError,
  darkMode 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSuccess: () => void,
  error: boolean,
  setError: (v: boolean) => void,
  darkMode: boolean
}) {
  const [pin, setPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1304') {
      onSuccess();
      setPin('');
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={cn(
              "relative w-full max-w-xs p-8 rounded-3xl shadow-2xl text-center",
              darkMode ? "bg-zinc-900 border border-zinc-800" : "bg-white"
            )}
          >
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-500">
              <Settings size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">Admin Access</h2>
            <p className="text-sm opacity-50 mb-6">Enter PIN to enable admin mode</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <input 
                autoFocus
                type="password"
                maxLength={4}
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(false);
                }}
                className={cn(
                  "w-full text-center text-2xl tracking-[1em] py-3 rounded-xl border outline-none transition-all",
                  error 
                    ? "border-red-500 bg-red-500/5 text-red-500" 
                    : (darkMode ? "bg-zinc-800 border-zinc-700 focus:border-emerald-500 text-white" : "bg-zinc-50 border-zinc-200 focus:border-emerald-500 text-zinc-900")
                )}
              />
              {error && <p className="text-red-500 text-xs font-medium">Incorrect PIN</p>}
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl font-medium opacity-50 hover:opacity-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20"
                >
                  Verify
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ConfirmationModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  darkMode 
}: { 
  isOpen: boolean, 
  title: string, 
  message: string, 
  onConfirm: () => void, 
  onCancel: () => void,
  darkMode: boolean
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={cn(
              "relative w-full max-w-sm p-6 rounded-3xl shadow-2xl",
              darkMode ? "bg-zinc-900 border border-zinc-800" : "bg-white"
            )}
          >
            <h2 className="text-xl font-bold mb-2">{title}</h2>
            <p className="text-sm opacity-70 mb-6">{message}</p>
            <div className="flex gap-3">
              <button 
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl font-medium opacity-50 hover:opacity-100 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={onConfirm}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/20"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function RestoreScreen({ onBack }: { onBack: () => void }) {
  const { state } = useApp();
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async (backup: any) => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      const batch = writeBatch(db);
      const collectionName = backup.type === 'CAR' ? 'cars' : 'accessories';
      
      // Restore the item
      batch.set(doc(db, collectionName, backup.data.id), backup.data);
      
      // Delete the backup
      batch.delete(doc(db, 'backups', backup.id));
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'restore');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteForever = async (id: string) => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      await deleteDoc(doc(db, 'backups', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'backups');
    } finally {
      setIsRestoring(false);
    }
  };

  const sortedBackups = [...state.backups].sort((a, b) => b.deletedAt - a.deletedAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
        >
          <ChevronRight className="rotate-180" />
        </button>
        <div>
          <h2 className="text-2xl font-bold">Restore Items</h2>
          <p className="text-xs opacity-50">Recover deleted brands and accessories</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {sortedBackups.map((backup) => (
          <div 
            key={backup.id}
            className={cn(
              "p-4 rounded-2xl border flex items-center justify-between gap-4",
              state.darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                backup.type === 'CAR' ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"
              )}>
                {backup.type === 'CAR' ? <CarIcon size={18} /> : <Settings size={18} />}
              </div>
              <div>
                <h3 className="font-bold">{backup.data.name}</h3>
                <p className="text-[10px] opacity-50">
                  Deleted: {new Date(backup.deletedAt).toLocaleString()} • {backup.type}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleRestore(backup)}
                disabled={isRestoring}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <RotateCcw size={14} />
                Restore
              </button>
              <button 
                onClick={() => handleDeleteForever(backup.id)}
                disabled={isRestoring}
                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
                title="Delete Forever"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}

        {sortedBackups.length === 0 && (
          <div className="py-20 text-center opacity-50">
            <History size={48} className="mx-auto mb-4 opacity-20" />
            <p>No deleted items to restore</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function AccessoryScreen({ car, onBack }: { car: any, onBack: () => void }) {
  const { state, dispatch } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStock, setNewStock] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accessories = state.accessories.filter(a => a.carId === car.id);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isSubmitting) return;
    if (accessories.some(a => a.name.toLowerCase() === newName.toLowerCase())) {
        setError('Accessory already exists for this car');
        return;
    }
    setIsSubmitting(true);
    const id = crypto.randomUUID();
    const stock = parseInt(newStock) || 0;
    try {
      await setDoc(doc(db, 'accessories', id), {
        id,
        carId: car.id,
        name: newName,
        stock: stock,
        updatedAt: Date.now(),
        updatedBy: state.role === 'ADMIN' ? 'Admin' : 'User'
      });
      setNewName('');
      setNewStock('0');
      setShowAdd(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'accessories');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStock = async (id: string, delta: number) => {
    const acc = state.accessories.find(a => a.id === id);
    if (!acc) return;
    const newStock = Math.max(0, acc.stock + delta);
    try {
      await updateDoc(doc(db, 'accessories', id), { 
        stock: newStock, 
        updatedAt: Date.now(),
        updatedBy: state.role === 'ADMIN' ? 'Admin' : 'User'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'accessories');
    }
  };

  const handleDirectStockInput = async (id: string, value: string) => {
    const newStock = parseInt(value);
    if (isNaN(newStock) || newStock < 0) return;
    try {
      await updateDoc(doc(db, 'accessories', id), { 
        stock: newStock, 
        updatedAt: Date.now(),
        updatedBy: state.role === 'ADMIN' ? 'Admin' : 'User'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'accessories');
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'accessories', id), { 
        name: editName,
        updatedAt: Date.now()
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'accessories');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccessory = async (id: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const accToDelete = state.accessories.find(a => a.id === id);
      if (!accToDelete) return;

      const batch = writeBatch(db);
      
      // Create backup
      const backupId = crypto.randomUUID();
      batch.set(doc(db, 'backups', backupId), {
        id: backupId,
        type: 'ACCESSORY',
        data: accToDelete,
        deletedAt: Date.now()
      });

      batch.delete(doc(db, 'accessories', id));
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'accessories');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
        >
          <ChevronRight className="rotate-180" />
        </button>
        <div>
          <h2 className="text-2xl font-bold">{car.name}</h2>
          <p className="text-xs opacity-50">Accessories Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {accessories.map((acc) => (
          <motion.div
            layout
            key={acc.id}
            className={cn(
              "p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
              state.darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
            )}
          >
            <div className="flex-1 w-full">
              {editingId === acc.id ? (
                <div className="flex gap-2 w-full">
                    <input 
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-transparent border-b border-emerald-500 outline-none font-bold flex-1"
                    />
                    <button onClick={() => handleRename(acc.id)} className="text-emerald-500 text-xs font-bold whitespace-nowrap">Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg leading-tight">{acc.name}</h3>
                    {state.role === 'ADMIN' && (
                        <button 
                            onClick={() => { setEditingId(acc.id); setEditName(acc.name); }}
                            className="p-1 text-zinc-400 hover:text-zinc-100"
                        >
                            <Settings size={12} />
                        </button>
                    )}
                </div>
              )}
              <p className="text-[10px] sm:text-xs opacity-50 mt-1">
                Last updated: {new Date(acc.updatedAt).toLocaleTimeString()} by {acc.updatedBy || 'System'}
              </p>
            </div>

            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
              <div className={cn(
                "flex items-center gap-2 p-1.5 rounded-2xl shadow-inner transition-all",
                state.darkMode ? "bg-zinc-800" : "bg-zinc-100"
              )}>
                <button 
                  onClick={() => updateStock(acc.id, -1)}
                  className={cn(
                    "w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 shadow-sm",
                    state.darkMode 
                      ? "hover:bg-zinc-700 bg-zinc-900 text-white" 
                      : "hover:bg-zinc-50 bg-white text-zinc-900 border border-zinc-200"
                  )}
                >
                  <Minus size={18} />
                </button>
                
                {state.role === 'ADMIN' ? (
                  <input 
                    type="number"
                    value={acc.stock}
                    onChange={(e) => handleDirectStockInput(acc.id, e.target.value)}
                    className={cn(
                      "w-14 text-center font-bold text-xl sm:text-lg bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                      state.darkMode ? "text-white" : "text-zinc-900"
                    )}
                  />
                ) : (
                  <span className={cn(
                    "w-10 text-center font-bold text-xl sm:text-lg",
                    state.darkMode ? "text-white" : "text-zinc-900"
                  )}>{acc.stock}</span>
                )}

                <button 
                  onClick={() => updateStock(acc.id, 1)}
                  className={cn(
                    "w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 shadow-sm",
                    state.darkMode 
                      ? "hover:bg-zinc-700 bg-zinc-900 text-white" 
                      : "hover:bg-zinc-50 bg-white text-zinc-900 border border-zinc-200"
                  )}
                >
                  <Plus size={18} />
                </button>
              </div>

              {state.role === 'ADMIN' && (
                <button 
                  onClick={() => setConfirmAction({
                    title: 'Delete Accessory',
                    message: `Are you sure you want to delete ${acc.name}?`,
                    onConfirm: () => { handleDeleteAccessory(acc.id); setConfirmAction(null); }
                  })}
                  className="p-2 text-zinc-400 hover:text-red-500 rounded-lg transition-all"
                >
                  <Trash2 size={20} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {accessories.length === 0 && (
          <div className="py-12 text-center opacity-50 col-span-full">
            <p>No accessories added yet</p>
          </div>
        )}
      </div>

      {state.role === 'ADMIN' && (
        <button 
          onClick={() => setShowAdd(true)}
          className="w-full py-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center gap-2 text-zinc-400 hover:text-emerald-500 hover:border-emerald-500 transition-all"
        >
          <Plus size={20} />
          <span className="font-bold">Add Accessory</span>
        </button>
      )}

      {/* Add Accessory Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAdd(false); setError(null); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className={cn(
                "relative w-full max-w-md p-6 rounded-3xl shadow-2xl",
                state.darkMode ? "bg-zinc-900" : "bg-white"
              )}
            >
              <h2 className="text-xl font-bold mb-4">Add Accessory to {car.name}</h2>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-50">Name</label>
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Accessory Name (e.g. 7D Mats)"
                    value={newName}
                    onChange={(e) => { setNewName(e.target.value); setError(null); }}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500/20",
                      state.darkMode ? "bg-zinc-800 border-zinc-700 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-900"
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-50">Initial Stock</label>
                  <input 
                    type="number"
                    placeholder="0"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500/20",
                      state.darkMode ? "bg-zinc-800 border-zinc-700 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-900"
                    )}
                  />
                </div>
                {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => { setShowAdd(false); setError(null); }}
                    className="flex-1 py-3 rounded-xl font-medium opacity-50 hover:opacity-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        onCancel={() => setConfirmAction(null)}
        darkMode={state.darkMode}
      />
    </motion.div>
  );
}
