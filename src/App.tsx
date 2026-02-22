import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Globe,
  Printer,
  Share2,
  Map as MapIcon,
  History,
  Compass,
  Sparkles,
  CookingPot, 
  Utensils, 
  Wine, 
  Calendar as CalendarIcon, 
  ShoppingCart, 
  Info, 
  ChevronRight, 
  ChevronLeft,
  Flame,
  Clock,
  DollarSign,
  Leaf,
  Zap,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { RECIPE_SCHEMA, SYSTEM_INSTRUCTION } from './constants';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  ResponsiveContainer 
} from 'recharts';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

// --- Types ---

interface Ingredient {
  name: string;
  amount: string;
  visualEvidence: string;
}

interface RecipeData {
  dishName: string;
  description: string;
  ingredients: Ingredient[];
  cookingTechniques: string[];
  steps: string[];
  nutrition: {
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
  };
  estimatedCostCLP: number;
  difficulty: string;
  equipment: string[];
  variations: {
    vegetarian: string;
    vegan: string;
    lowCarb: string;
  };
  chefTips: string[];
  internationalSubstitutes: {
    originalIngredient: string;
    substitute: string;
    region: string;
    notes: string;
  }[];
  origin: {
    region: string;
    story: string;
  };
  pairing: {
    wine: {
      name: string;
      explanation: string;
      price: string;
      temp: string;
      flavorProfile: {
        tannins: number;
        body: number;
        acidity: number;
        sweetness: number;
        intensity: number;
      };
    };
    alternatives: {
      budget: string;
      nonAlcoholic: string;
      beer: string;
      cocktail: string;
    };
    miniCourse: string;
  };
}

interface MealPlan {
  id?: number;
  date: string;
  recipe_name: string;
  recipe_data: RecipeData;
  filters: string[];
}

// --- Components ---

const FlavorWheel = ({ data }: { data: any }) => {
  const chartData = [
    { subject: 'Taninos', A: data.tannins, fullMark: 10 },
    { subject: 'Cuerpo', A: data.body, fullMark: 10 },
    { subject: 'Acidez', A: data.acidity, fullMark: 10 },
    { subject: 'Dulzor', A: data.sweetness, fullMark: 10 },
    { subject: 'Intensidad', A: data.intensity, fullMark: 10 },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
          <Radar
            name="Wine"
            dataKey="A"
            stroke="#0039A6"
            fill="#0039A6"
            fillOpacity={0.6}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

const ChileMap = ({ activeRegion }: { activeRegion: string }) => {
  // A simplified, stylized vertical representation of Chile
  return (
    <div className="relative h-[400px] w-16 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
      <div className="absolute inset-0 flex flex-col justify-between py-4 items-center">
        {[...Array(16)].map((_, i) => (
          <div 
            key={i} 
            className={`w-2 h-2 rounded-full transition-all duration-500 ${
              activeRegion.toLowerCase().includes(`región ${i+1}`) || 
              activeRegion.toLowerCase().includes(`region ${i+1}`) ||
              (i === 6 && activeRegion.toLowerCase().includes('metropolitana'))
                ? 'bg-chile-red scale-150 shadow-[0_0_10px_rgba(213,43,30,0.5)]' 
                : 'bg-stone-300'
            }`}
          />
        ))}
      </div>
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-gradient-to-b from-transparent via-stone-200/20 to-transparent" />
    </div>
  );
};

const CURRENCIES = [
  { code: 'CLP', symbol: '$', rate: 1, name: 'Chile (Peso)' },
  { code: 'USD', symbol: '$', rate: 0.0011, name: 'EE.UU. (Dólar)' },
  { code: 'EUR', symbol: '€', rate: 0.0010, name: 'Europa (Euro)' },
  { code: 'CAD', symbol: '$', rate: 0.0015, name: 'Canadá (Dólar)' },
  { code: 'ARS', symbol: '$', rate: 0.95, name: 'Argentina (Peso)' },
  { code: 'MXN', symbol: '$', rate: 0.019, name: 'México (Peso)' },
];

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<RecipeData | null>(null);
  const [activeTab, setActiveTab] = useState<'recipe' | 'pairing' | 'planner'>('recipe');
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [selectedCurrency, setSelectedCurrency] = useState(CURRENCIES[0]);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatCost = (clp: number) => {
    const converted = clp * selectedCurrency.rate;
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: selectedCurrency.code,
      minimumFractionDigits: selectedCurrency.code === 'CLP' ? 0 : 2
    }).format(converted);
  };

  useEffect(() => {
    fetchMealPlans();
  }, []);

  const toggleIngredient = (index: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedIngredients(newChecked);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receta de ${recipe?.dishName} - Foodie Chilena`,
          text: `Mira esta receta de ${recipe?.dishName} que encontré en Foodie Chilena!`,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Error sharing", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Enlace copiado al portapapeles");
    }
  };

  const fetchMealPlans = async () => {
    try {
      const res = await fetch('/api/meal-plans');
      const data = await res.json();
      setMealPlans(data);
    } catch (err) {
      console.error("Error fetching meal plans", err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        analyzeImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (base64: string) => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            parts: [
              { text: "Analiza este plato y genera la receta completa en JSON." },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64.split(',')[1]
                }
              }
            ]
          }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: RECIPE_SCHEMA as any
        }
      });

      const data = JSON.parse(response.text || '{}');
      setRecipe(data);
      setActiveTab('recipe');
    } catch (err) {
      console.error("Analysis failed", err);
      alert("Error al analizar la imagen. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const addToPlanner = async (date: Date) => {
    if (!recipe) return;
    try {
      const res = await fetch('/api/meal-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(date, 'yyyy-MM-dd'),
          recipe_name: recipe.dishName,
          recipe_data: recipe,
          filters: []
        })
      });
      if (res.ok) {
        fetchMealPlans();
        setActiveTab('planner');
      }
    } catch (err) {
      console.error("Error adding to planner", err);
    }
  };

  const deleteMealPlan = async (id: number) => {
    try {
      await fetch(`/api/meal-plans/${id}`, { method: 'DELETE' });
      fetchMealPlans();
    } catch (err) {
      console.error("Error deleting meal plan", err);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const shoppingList = mealPlans.reduce((acc: { [key: string]: string }, plan) => {
    plan.recipe_data.ingredients.forEach(ing => {
      if (acc[ing.name]) {
        acc[ing.name] += `, ${ing.amount}`;
      } else {
        acc[ing.name] = ing.amount;
      }
    });
    return acc;
  }, {});

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 glass px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-mustard p-2 rounded-xl shadow-lg">
            <CookingPot className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold tracking-tight">Foodie Chilena</h1>
            <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">Experticia Culinaria</p>
          </div>
        </div>
        
        <nav className="hidden md:flex items-center gap-2 bg-stone-100/50 p-1.5 rounded-2xl">
          {(['recipe', 'pairing', 'planner'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-button ${
                activeTab === tab ? 'bg-white shadow-sm text-mustard' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {tab === 'recipe' && 'Receta'}
              {tab === 'pairing' && 'Maridaje'}
              {tab === 'planner' && 'Planificador'}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {recipe && (
            <div className="flex items-center gap-2 mr-4">
              <button 
                onClick={handlePrint}
                className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
                title="Imprimir Receta"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button 
                onClick={handleShare}
                className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
                title="Compartir Receta"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          )}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Analizar Plato</span>
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          accept="image/*" 
          className="hidden" 
        />
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {!recipe && !loading && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="w-40 h-40 bg-mustard/5 rounded-[3rem] flex items-center justify-center mb-12 relative"
                >
                  <div className="absolute inset-0 border-2 border-dashed border-mustard/20 rounded-[3rem] animate-[spin_20s_linear_infinite]" />
                  <Upload className="w-16 h-16 text-mustard/40" />
                </motion.div>
                <h2 className="text-5xl font-serif font-bold mb-6 tracking-tight">Tu mesa, <span className="text-chile-red italic">reimaginada.</span></h2>
                <p className="text-stone-500 max-w-lg mb-12 text-lg leading-relaxed">
                  Sube una fotografía de cualquier plato y deja que nuestra inteligencia culinaria chilena revele sus secretos más profundos.
                </p>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary shadow-2xl shadow-mustard/30"
                >
                  <Camera className="w-6 h-6" />
                  Comenzar Análisis
                </button>
              </div>
          )}

          {loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative w-24 h-24 mb-8">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="absolute inset-0 border-4 border-mustard/20 border-t-mustard rounded-full"
                />
                <CookingPot className="absolute inset-0 m-auto w-10 h-10 text-mustard animate-bounce" />
              </div>
              <h3 className="text-xl font-serif font-bold mb-2">Chef analizando...</h3>
              <p className="text-stone-500 italic">"Identificando ese sofrito perfecto..."</p>
            </motion.div>
          )}

          {recipe && !loading && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {activeTab === 'recipe' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Image & Basic Info */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="recipe-card">
                      <img src={image!} alt="Dish" className="w-full aspect-square object-cover" />
                      <div className="p-6">
                        <h2 className="text-2xl font-serif font-bold mb-2">{recipe.dishName}</h2>
                        <p className="text-stone-600 text-sm mb-4">{recipe.description}</p>
                        
                        <div className="flex flex-wrap gap-2 mb-6">
                          <span className="bg-stone-100 text-stone-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <Flame className="w-3 h-3" /> {recipe.difficulty}
                          </span>
                          <span className="bg-stone-100 text-stone-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 45 min
                          </span>
                          <div className="relative group">
                            <span className="bg-mustard/10 text-mustard px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-mustard/20 transition-colors">
                              <DollarSign className="w-3 h-3" /> {formatCost(recipe.estimatedCostCLP)}
                            </span>
                            <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-stone-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                              <p className="text-[10px] font-bold text-stone-400 uppercase px-2 mb-1">Cambiar Moneda</p>
                              {CURRENCIES.map(curr => (
                                <button
                                  key={curr.code}
                                  onClick={() => setSelectedCurrency(curr)}
                                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${selectedCurrency.code === curr.code ? 'bg-mustard/10 text-mustard font-bold' : 'hover:bg-stone-50'}`}
                                >
                                  {curr.name} ({curr.code})
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs uppercase tracking-widest font-bold text-stone-400">Nutrición (por porción)</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-100">
                              <p className="text-[10px] text-stone-500 uppercase font-bold">Calorías</p>
                              <p className="font-mono font-bold">{recipe.nutrition.calories}</p>
                            </div>
                            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-100">
                              <p className="text-[10px] text-stone-500 uppercase font-bold">Proteína</p>
                              <p className="font-mono font-bold">{recipe.nutrition.protein}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="recipe-card p-6">
                      <h4 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-4 flex items-center gap-2">
                        <Utensils className="w-4 h-4" /> Equipamiento Sugerido
                      </h4>
                      <ul className="space-y-2">
                        {recipe.equipment.map((item, i) => (
                          <li key={i} className="text-sm flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-chile-blue rounded-full" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Right Column: Ingredients & Steps */}
                  <div className="lg:col-span-2 space-y-8">
                    {/* Origin Section */}
                    <section className="recipe-card p-8 bg-stone-50/50 border-dashed">
                      <div className="flex flex-col md:flex-row gap-8 items-center">
                        <div className="flex-shrink-0">
                          <ChileMap activeRegion={recipe.origin?.region || ''} />
                          <p className="text-[10px] font-bold text-stone-400 mt-2 text-center uppercase tracking-tighter">Mapa de Origen</p>
                        </div>
                        <div className="flex-grow space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-mustard/10 p-2 rounded-lg">
                              <History className="w-5 h-5 text-mustard" />
                            </div>
                            <h3 className="text-xl font-serif font-bold">Historia y Origen</h3>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-chile-red uppercase tracking-widest">
                              {recipe.origin?.region || 'Región no especificada'}
                            </p>
                            <p className="text-stone-600 leading-relaxed text-sm italic">
                              "{recipe.origin?.story || 'La historia de este plato se pierde en el tiempo, pero su sabor permanece intacto en el corazón de Chile.'}"
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="recipe-card p-8">
                      <h3 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
                        <Info className="w-5 h-5 text-chile-blue" /> Ingredientes Detectados
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recipe.ingredients.map((ing, i) => (
                          <div 
                            key={i} 
                            onClick={() => toggleIngredient(i)}
                            className={`flex flex-col p-5 rounded-3xl border transition-all cursor-pointer ${
                              checkedIngredients.has(i) 
                                ? 'bg-stone-50 border-stone-100 opacity-40' 
                                : 'bg-white border-stone-100 hover:border-mustard/30 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${checkedIngredients.has(i) ? 'bg-emerald-500 border-emerald-500' : 'border-stone-200'}`}>
                                  {checkedIngredients.has(i) && <CheckCircle2 className="w-4 h-4 text-white" />}
                                </div>
                                <span className={`font-bold text-stone-800 ${checkedIngredients.has(i) ? 'line-through' : ''}`}>{ing.name}</span>
                              </div>
                              <span className="text-xs text-chile-red font-mono font-black bg-chile-red/5 px-2 py-1 rounded-lg">{ing.amount}</span>
                            </div>
                            <p className="text-[10px] text-stone-400 italic ml-9 leading-tight">Evidencia: {ing.visualEvidence}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="recipe-card p-8">
                      <h3 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
                        <ChevronRight className="w-5 h-5 text-chile-red" /> Preparación Paso a Paso
                      </h3>
                      <div className="space-y-6">
                        {recipe.steps.map((step, i) => (
                          <div key={i} className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center font-mono font-bold text-stone-500">
                              {i + 1}
                            </div>
                            <p className="text-stone-700 leading-relaxed pt-1">{step}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="recipe-card p-6 bg-emerald-50 border-emerald-100">
                        <h4 className="text-xs uppercase tracking-widest font-bold text-emerald-600 mb-4 flex items-center gap-2">
                          <Leaf className="w-4 h-4" /> Variaciones
                        </h4>
                        <div className="space-y-3">
                          <p className="text-xs"><span className="font-bold">Vegetariana:</span> {recipe.variations.vegetarian}</p>
                          <p className="text-xs"><span className="font-bold">Vegan:</span> {recipe.variations.vegan}</p>
                        </div>
                      </div>
                      <div className="recipe-card p-6 bg-amber-50 border-amber-100">
                        <h4 className="text-xs uppercase tracking-widest font-bold text-amber-600 mb-4 flex items-center gap-2">
                          <Zap className="w-4 h-4" /> Tips de Chef
                        </h4>
                        <ul className="space-y-2">
                          {recipe.chefTips.map((tip, i) => (
                            <li key={i} className="text-xs italic">"{tip}"</li>
                          ))}
                        </ul>
                      </div>
                    </section>

                    {/* International Substitutes Section */}
                    {recipe.internationalSubstitutes && recipe.internationalSubstitutes.length > 0 && (
                      <section className="recipe-card p-8 bg-blue-50/30 border-blue-100 border-dashed">
                        <h3 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
                          <Globe className="w-5 h-5 text-chile-blue" /> Chileno en el Extranjero
                        </h3>
                        <p className="text-stone-500 text-sm mb-6">¿No encuentras los ingredientes originales? Aquí tienes las mejores alternativas internacionales para no perder el sabor de casa.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {recipe.internationalSubstitutes.map((sub, i) => (
                            <div key={i} className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-chile-red uppercase tracking-tighter">{sub.originalIngredient}</span>
                                <span className="text-[10px] font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{sub.region}</span>
                              </div>
                              <p className="text-sm font-bold text-stone-800 mb-1">Usar: {sub.substitute}</p>
                              <p className="text-xs text-stone-500 italic">{sub.notes}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    <div className="flex justify-center pt-4">
                      <button 
                        onClick={() => setActiveTab('planner')}
                        className="btn-secondary flex items-center gap-2"
                      >
                        <CalendarIcon className="w-5 h-5" />
                        Añadir al Planificador Semanal
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'pairing' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="recipe-card p-8 space-y-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-chile-blue/10 p-3 rounded-2xl">
                        <Wine className="w-8 h-8 text-chile-blue" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-serif font-bold">Maridaje Experto</h3>
                        <p className="text-stone-500 text-sm">Sugerencia de nuestro sommelier</p>
                      </div>
                    </div>

                    <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
                      <h4 className="text-chile-blue font-bold text-lg mb-2">{recipe.pairing.wine.name}</h4>
                      <p className="text-stone-600 text-sm leading-relaxed mb-4">{recipe.pairing.wine.explanation}</p>
                      <div className="flex gap-4 text-xs font-bold">
                        <span className="bg-white px-3 py-1 rounded-full border border-stone-200">Temp: {recipe.pairing.wine.temp}</span>
                        <span className="bg-white px-3 py-1 rounded-full border border-stone-200">Precio: {recipe.pairing.wine.price}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs uppercase tracking-widest font-bold text-stone-400">Perfil de Sabor</h4>
                      <FlavorWheel data={recipe.pairing.wine.flavorProfile} />
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="recipe-card p-8">
                      <h4 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-6 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Otras Alternativas
                      </h4>
                      <div className="grid gap-4">
                        <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                            <DollarSign className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-stone-400">Económico</p>
                            <p className="text-sm font-medium">{recipe.pairing.alternatives.budget}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                            <X className="w-5 h-5 text-red-400" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-stone-400">Sin Alcohol</p>
                            <p className="text-sm font-medium">{recipe.pairing.alternatives.nonAlcoholic}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                            <Utensils className="w-5 h-5 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-stone-400">Cerveza</p>
                            <p className="text-sm font-medium">{recipe.pairing.alternatives.beer}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="recipe-card p-8 bg-chile-blue text-white">
                      <h4 className="text-xs uppercase tracking-widest font-bold text-white/60 mb-4 flex items-center gap-2">
                        <Info className="w-4 h-4" /> Mini-Curso de Maridaje
                      </h4>
                      <p className="text-sm leading-relaxed italic">
                        "{recipe.pairing.miniCourse}"
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'planner' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-serif font-bold">Planificador Semanal</h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
                        className="p-2 hover:bg-stone-100 rounded-full"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="font-medium text-sm">
                        Semana del {format(currentWeekStart, 'd MMM', { locale: es })}
                      </span>
                      <button 
                        onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
                        className="p-2 hover:bg-stone-100 rounded-full"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                    {weekDays.map((day) => {
                      const dayPlans = mealPlans.filter(p => isSameDay(new Date(p.date), day));
                      return (
                        <div key={day.toString()} className="recipe-card p-4 min-h-[150px] flex flex-col">
                          <p className="text-[10px] uppercase font-bold text-stone-400 mb-2">
                            {format(day, 'EEEE', { locale: es })}
                          </p>
                          <p className="text-lg font-bold mb-4">{format(day, 'd')}</p>
                          
                          <div className="flex-grow space-y-2">
                            {dayPlans.map(plan => (
                              <div key={plan.id} className="bg-chile-blue/5 p-2 rounded-lg text-[10px] relative group">
                                <p className="font-bold text-chile-blue truncate">{plan.recipe_name}</p>
                                <button 
                                  onClick={() => deleteMealPlan(plan.id!)}
                                  className="absolute -top-1 -right-1 bg-white shadow-sm p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-2 h-2 text-red-500" />
                                </button>
                              </div>
                            ))}
                          </div>

                          <button 
                            onClick={() => addToPlanner(day)}
                            className="mt-4 w-full py-1 border border-dashed border-stone-300 rounded-lg text-[10px] text-stone-400 hover:border-chile-red hover:text-chile-red transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Añadir
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="recipe-card p-8">
                      <h4 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-chile-blue" /> Lista de Compras Unificada
                      </h4>
                      <div className="space-y-3">
                        {Object.keys(shoppingList).length > 0 ? (
                          Object.entries(shoppingList).map(([name, amount], i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                              <CheckCircle2 className="w-4 h-4 text-stone-300" />
                              <div className="flex-grow flex justify-between">
                                <span className="text-sm font-medium">{name}</span>
                                <span className="text-xs text-stone-400">{amount}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-stone-400 text-sm italic">No hay ingredientes en tu lista aún.</p>
                        )}
                      </div>
                    </div>

                    <div className="recipe-card p-8 bg-stone-900 text-white">
                      <h4 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
                        <Scale className="w-5 h-5 text-chile-red" /> Ajustes de Porción
                      </h4>
                      <p className="text-stone-400 text-sm mb-6">Ajusta las porciones para toda la semana y recalcularemos las cantidades automáticamente.</p>
                      <div className="flex items-center gap-4">
                        <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="text-center">
                          <p className="text-3xl font-bold">4</p>
                          <p className="text-[10px] uppercase font-bold text-white/40">Personas</p>
                        </div>
                        <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-stone-200 px-6 py-3 flex justify-around items-center z-50">
        <button 
          onClick={() => setActiveTab('recipe')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'recipe' ? 'text-chile-red' : 'text-stone-400'}`}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Receta</span>
        </button>
        <button 
          onClick={() => setActiveTab('pairing')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'pairing' ? 'text-chile-blue' : 'text-stone-400'}`}
        >
          <Wine className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Maridaje</span>
        </button>
        <button 
          onClick={() => setActiveTab('planner')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'planner' ? 'text-chile-red' : 'text-stone-400'}`}
        >
          <CalendarIcon className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Plan</span>
        </button>
      </nav>
    </div>
  );
}
