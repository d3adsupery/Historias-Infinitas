import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GameLayout } from './components/GameLayout';
import { Button } from './components/Button';
import { Typewriter } from './components/Typewriter';
import { generateStorySegment, generateSceneImage } from './services/geminiService';
import { GameTurn, Choice } from './types';
import { 
  Heart, 
  Backpack, 
  Swords, 
  Skull, 
  History, 
  RefreshCw,
  Loader2,
  X,
  Box,
  ImageIcon
} from 'lucide-react';

const INITIAL_HP = 100;

const THEME_POOL = [
  'Fantasía Oscura', 'Cyberpunk 2077', 'Apocalipsis Zombie', 'Misterio Victoriano',
  'Piratas del Espacio', 'Samurai Feudal', 'Terror Lovecraftiano', 'Western Mágico',
  'Hackers de los 90', 'Mitología Griega', 'Superhéroes Realistas', 'Exploración Submarina',
  'Steampunk', 'Supervivencia en Isla Desierta', 'Guerra de IAs', 'Vampiros Modernos'
];

const App: React.FC = () => {
  // Application Modes
  const [mode, setMode] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  
  // Game State
  const [theme, setTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [suggestedThemes, setSuggestedThemes] = useState<string[]>([]);
  const [hp, setHp] = useState(INITIAL_HP);
  const [inventory, setInventory] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState<GameTurn | null>(null);
  
  // Loading States
  const [isStoryLoading, setIsStoryLoading] = useState(false); // Waiting for text JSON
  const [isImageLoading, setIsImageLoading] = useState(false); // Waiting for image generation
  const [isTypingComplete, setIsTypingComplete] = useState(false); // Text typewriter finished
  
  // UI State
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  
  // Refs for auto-scrolling
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initialize Random Themes on mount
  useEffect(() => {
    const shuffled = [...THEME_POOL].sort(() => 0.5 - Math.random());
    setSuggestedThemes(shuffled.slice(0, 4));
  }, []);

  // Helper to scroll to bottom
  const scrollToBottom = () => {
    // Only scroll if we are not at the very top (initial load)
    if (currentTurn) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  // Logic to determine when to show choices
  // Rules: 
  // 1. Text must be fully typed (isTypingComplete)
  // 2. Image must be loaded OR failed (isImageLoading must be false)
  const areChoicesVisible = !isStoryLoading && isTypingComplete && !isImageLoading;

  useEffect(() => {
    if (areChoicesVisible) {
      setTimeout(scrollToBottom, 100);
    }
  }, [areChoicesVisible]);

  // Start Game Handler
  const handleStartGame = async () => {
    const selectedTheme = customTheme.trim() || theme;
    if (!selectedTheme) return;

    setMode('PLAYING');
    setIsStoryLoading(true);
    setHp(INITIAL_HP);
    setInventory([]);
    setCustomTheme('');
    setCurrentTurn(null);
    setIsTypingComplete(false);
    setIsImageLoading(false);
    
    await processTurn(selectedTheme, INITIAL_HP, [], null, "Inicio de la historia");
  };

  // Process a turn (Parallel Logic)
  const processTurn = async (
    currentTheme: string, 
    currentHp: number, 
    currentInv: string[], 
    choiceText: string | null,
    historyCtx: string
  ) => {
    try {
      setIsStoryLoading(true);
      setIsTypingComplete(false);
      setIsImageLoading(false);

      // 1. Generate Story Logic & Text
      const storyData = await generateStorySegment(currentTheme, currentHp, currentInv, choiceText, historyCtx);

      // 2. Update Game State IMMEDIATELY with text (Image is undefined for now)
      const newHp = Math.min(100, Math.max(0, currentHp + storyData.hpChange));
      
      let newInv = [...currentInv];
      newInv = newInv.filter(item => !storyData.inventoryRemove.includes(item));
      storyData.inventoryAdd.forEach(item => {
        if (!newInv.includes(item)) newInv.push(item);
      });

      setHp(newHp);
      setInventory(newInv);

      if (storyData.isGameOver || newHp <= 0) {
        setMode('GAMEOVER');
        setCurrentTurn({
            text: storyData.narrative,
            imageUrl: undefined,
            choices: []
        });
        setIsStoryLoading(false);
        // Don't generate image for game over to save time/tokens, or do it if you want.
        return;
      }

      // Set turn with NO image yet
      setCurrentTurn({
        text: storyData.narrative,
        imageUrl: undefined,
        choices: storyData.choices
      });
      
      // Stop "Story Loading" spinner, this triggers Typewriter to start
      setIsStoryLoading(false); 

      // 3. Trigger Image Generation in Background
      if (storyData.visualDescription) {
        setIsImageLoading(true);
        // We do not await this here to block the UI. We let it run.
        generateSceneImage(storyData.visualDescription).then((url) => {
            // Update the current turn with the image URL when it arrives
            setCurrentTurn(prev => prev ? { ...prev, imageUrl: url } : null);
            setIsImageLoading(false);
        }).catch(err => {
            console.error("Background image generation failed", err);
            setIsImageLoading(false);
        });
      }

    } catch (e) {
      console.error(e);
      setMode('START'); 
      alert("Hubo un error crítico conectando con el mundo. Intenta de nuevo.");
      setIsStoryLoading(false);
    }
  };

  const handleChoice = (choice: Choice) => {
    if (!currentTurn) return;
    
    // Construct brief context
    const historyContext = `Anteriormente: ${currentTurn.text.substring(0, 200)}...`;
    
    processTurn(
      theme || customTheme, 
      hp, 
      inventory, 
      choice.text, 
      historyContext
    );
  };

  const resetGame = () => {
    setMode('START');
    setHp(INITIAL_HP);
    setInventory([]);
    setCurrentTurn(null);
    setIsStoryLoading(false);
    setIsImageLoading(false);
    setIsTypingComplete(false);
    
    const shuffled = [...THEME_POOL].sort(() => 0.5 - Math.random());
    setSuggestedThemes(shuffled.slice(0, 4));
  };

  const onTextComplete = useCallback(() => {
    setIsTypingComplete(true);
  }, []);

  // --- RENDERERS ---

  const renderInventoryModal = () => {
    if (!isInventoryOpen) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsInventoryOpen(false)}>
        <div 
          className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden transform transition-all scale-100" 
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-slate-800 p-4 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-2 text-indigo-400 font-cinzel font-bold text-lg">
              <Backpack size={20} />
              <span>Inventario</span>
            </div>
            <button onClick={() => setIsInventoryOpen(false)} className="text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 min-h-[200px] max-h-[60vh] overflow-y-auto">
             {inventory.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 py-8">
                 <Box size={40} className="opacity-50" />
                 <p>Tu mochila está vacía.</p>
               </div>
             ) : (
               <ul className="space-y-2">
                 {inventory.map((item, idx) => (
                   <li key={idx} className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800 text-slate-200">
                     <div className="w-2 h-2 rounded-full bg-indigo-500" />
                     {item}
                   </li>
                 ))}
               </ul>
             )}
          </div>
          <div className="bg-slate-800/50 p-3 text-center text-xs text-slate-500 border-t border-slate-800">
             Capacidad: {inventory.length}/Infinite
          </div>
        </div>
      </div>
    );
  };

  const renderStartScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <div className="inline-block p-4 rounded-full bg-indigo-500/10 mb-4 ring-1 ring-indigo-500/50">
          <Swords size={48} className="text-indigo-400" />
        </div>
        <h1 className="text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-white to-purple-200">
          AI Chronicles
        </h1>
        <p className="text-slate-400 max-w-md mx-auto text-lg">
          Elige tu destino. Una historia infinita generada solo para ti.
        </p>
      </div>

      <div className="w-full max-w-md space-y-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Elige un tema</label>
          <div className="grid grid-cols-2 gap-3">
            {suggestedThemes.map((t) => (
              <button
                key={t}
                onClick={() => { setTheme(t); setCustomTheme(t); }}
                className={`p-3 rounded-lg text-sm font-medium transition-all ${
                  customTheme === t 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider">O escribe el tuyo</label>
          <input
            type="text"
            value={customTheme}
            onChange={(e) => setCustomTheme(e.target.value)}
            placeholder="Ej: Un samurai en el espacio..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
          />
        </div>

        <Button 
          fullWidth 
          onClick={handleStartGame} 
          disabled={!customTheme || isStoryLoading}
          className="mt-4"
        >
          {isStoryLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={20} /> Generando Mundo...
            </span>
          ) : (
            "Comenzar Aventura"
          )}
        </Button>
      </div>
    </div>
  );

  const renderGameScreen = () => (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header Stats */}
      <div className="sticky top-4 z-40 bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-700/50 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-rose-400 font-bold">
            <Heart className={hp < 30 ? "animate-pulse" : ""} fill={hp < 30 ? "currentColor" : "none"} />
            <span>{hp}%</span>
          </div>
          <button 
            onClick={() => setIsInventoryOpen(true)}
            className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-amber-400/50"
          >
            <Backpack size={18} />
            <span className="text-sm font-medium hidden sm:inline">
              Mochila ({inventory.length})
            </span>
          </button>
        </div>
        <button 
          onClick={resetGame}
          className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"
          title="Reiniciar"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {renderInventoryModal()}

      {/* Main Content Area */}
      <div className="space-y-6">
        
        {/* Initial Loading State */}
        {isStoryLoading && !currentTurn && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 animate-pulse">
            <Loader2 size={48} className="animate-spin mb-4 text-indigo-500" />
            <p>La historia se está escribiendo...</p>
          </div>
        )}

        {currentTurn && (
          <div className="space-y-6 animate-fade-in-up">
            
            {/* Image Section - Smaller & Centered */}
            <div className="flex justify-center w-full">
                <div className="w-full max-w-2xl h-48 md:h-64 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative group">
                {currentTurn.imageUrl ? (
                    <img 
                    src={currentTurn.imageUrl} 
                    alt="Scene visualization" 
                    className="w-full h-full object-cover animate-fade-in"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
                    <div className="flex flex-col items-center text-slate-600 gap-2">
                        {isImageLoading ? (
                            <>
                                <Loader2 className="animate-spin text-indigo-400" />
                                <span className="text-xs text-indigo-300">Dibujando escena...</span>
                            </>
                        ) : (
                            <ImageIcon className="opacity-20" />
                        )}
                    </div>
                    </div>
                )}
                <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />
                </div>
            </div>

            {/* Text Section */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-white/5 backdrop-blur-sm min-h-[100px]">
              <Typewriter 
                text={currentTurn.text} 
                speed={15} 
                onComplete={onTextComplete} 
              />
            </div>

            {/* Waiting Indicator (if text finished but image still loading) */}
            {isTypingComplete && isImageLoading && (
                <div className="flex items-center justify-center gap-2 text-slate-500 text-sm animate-pulse py-2">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Esperando ilustración...</span>
                </div>
            )}

            {/* Choices Zone - Not Fixed anymore, distinct area */}
            <div className="pt-4 pb-2">
                {areChoicesVisible ? (
                    <div className="grid grid-cols-1 gap-3 animate-fade-in-up" ref={bottomRef}>
                        <div className="text-center text-sm text-slate-500 mb-2 uppercase tracking-widest font-bold">¿Qué harás?</div>
                        {currentTurn.choices.map((choice) => (
                        <Button
                            key={choice.id}
                            onClick={() => handleChoice(choice)}
                            disabled={isStoryLoading}
                            variant="secondary"
                            className="text-left h-auto py-4 px-5 border-slate-700 hover:border-indigo-500 hover:bg-slate-800 shadow-lg group relative overflow-hidden"
                        >
                            <span className="relative z-10">{choice.text}</span>
                            <div className="absolute inset-0 bg-indigo-500/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
                        </Button>
                        ))}
                    </div>
                ) : (
                   /* Invisible placeholder to prevent heavy layout shift if needed, or just nothing */
                   null
                )}
            </div>
            
            {/* Loading Indicator for Next Turn logic */}
            {isStoryLoading && (
                 <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-indigo-400" size={32} />
                 </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderGameOver = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-8 animate-fade-in">
      <div className="bg-red-500/10 p-6 rounded-full ring-1 ring-red-500/50">
        <Skull size={64} className="text-red-500" />
      </div>
      
      <div className="space-y-4 max-w-lg">
        <h2 className="text-4xl font-bold text-white">Has Caído</h2>
        <p className="text-slate-400 text-lg">
          Tu historia ha llegado a un final trágico. Pero en el multiverso, cada final es un nuevo comienzo.
        </p>
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 text-left text-sm text-slate-500">
          <p>Causa: {hp <= 0 ? "Muerte por heridas (HP: 0)" : "Final de la trama"}</p>
          <p>Objetos Finales: {inventory.join(', ') || "Ninguno"}</p>
        </div>
      </div>

      <Button onClick={resetGame} variant="primary" className="px-8">
        Reencarnar
      </Button>
    </div>
  );

  return (
    <GameLayout>
      {mode === 'START' && renderStartScreen()}
      {mode === 'PLAYING' && renderGameScreen()}
      {mode === 'GAMEOVER' && renderGameOver()}
    </GameLayout>
  );
};

export default App;