import { useEffect, useState } from 'react';

export interface NutritionData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foodName?: string;
  portion?: string;
}

interface FoodNutritionCardProps {
  nutrition: NutritionData;
  editable?: boolean;
  onMacroChange?: (field: 'protein' | 'carbs' | 'fat', value: number) => void;
}

export function parseNutrition(log: any): NutritionData | null {
  if (!log) return null;

  // 1. Check if structured nutrition object exists
  if (log.nutrition) {
    return {
      calories: Math.round(Number(log.nutrition.calories)) || 0,
      protein: Number(log.nutrition.protein) || 0,
      carbs: Number(log.nutrition.carbs) || 0,
      fat: Number(log.nutrition.fat) || 0,
      foodName: log.nutrition.foodName || '',
      portion: log.nutrition.portion || ''
    };
  }

  // 2. Fallback: Parse from comment text using regex for legacy support
  if (log.comment) {
    const comment = log.comment;
    // Look for AI output markers
    if (comment.includes('พลังงานรวม:') || comment.includes('โปรตีนรวม:')) {
      const calMatch = comment.match(/พลังงานรวม:\s*([\d.]+)/);
      const protMatch = comment.match(/โปรตีนรวม:\s*([\d.]+)/);
      const carbMatch = comment.match(/คาร์บรวม:\s*([\d.]+)/);
      const fatMatch = comment.match(/ไขมันรวม:\s*([\d.]+)/);
      const foodMatch = comment.match(/อาหาร:\s*([^\n(]+)/);
      const portionMatch = comment.match(/อาหาร:[^\n(]+\(([^)]+)\)/);

      if (calMatch || protMatch || carbMatch || fatMatch) {
        return {
          calories: calMatch ? Math.round(Number(calMatch[1])) : 0,
          protein: protMatch ? Number(protMatch[1]) : 0,
          carbs: carbMatch ? Number(carbMatch[1]) : 0,
          fat: fatMatch ? Number(fatMatch[1]) : 0,
          foodName: foodMatch ? foodMatch[1].trim() : '',
          portion: portionMatch ? portionMatch[1].trim() : ''
        };
      }
    }
  }

  return null;
}

export default function FoodNutritionCard({ nutrition, editable = false, onMacroChange }: FoodNutritionCardProps) {
  const { calories, protein, carbs, fat, foodName, portion } = nutrition;
  const [macroInputs, setMacroInputs] = useState({
    protein: String(protein),
    carbs: String(carbs),
    fat: String(fat)
  });
  const [focusedMacro, setFocusedMacro] = useState<'protein' | 'carbs' | 'fat' | null>(null);

  useEffect(() => {
    if (focusedMacro) return;

    setMacroInputs({
      protein: String(protein),
      carbs: String(carbs),
      fat: String(fat)
    });
  }, [protein, carbs, fat, focusedMacro]);
  const macroInputStyle = {
    width: '100%',
    maxWidth: '58px',
    height: '26px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    textAlign: 'center' as const,
    fontSize: '0.85rem',
    fontWeight: 800,
    background: '#ffffff',
    outline: 'none'
  };

  const handleMacroInput = (field: 'protein' | 'carbs' | 'fat', rawValue: string) => {
    setMacroInputs(prev => ({ ...prev, [field]: rawValue }));
    onMacroChange?.(field, rawValue === '' ? 0 : Math.max(0, Number(rawValue) || 0));
  };

  const handleMacroBlur = (field: 'protein' | 'carbs' | 'fat') => {
    setFocusedMacro(null);
    if (macroInputs[field] === '') {
      setMacroInputs(prev => ({ ...prev, [field]: '0' }));
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '0.85rem',
      margin: '0.75rem 0',
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.02)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {foodName && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem' }}>
          <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>
            🍽️ {foodName}
          </span>
          {portion && (
            <span style={{ fontSize: '0.75rem', color: '#475569', background: '#cbd5e1', padding: '2px 8px', borderRadius: '12px', fontWeight: '500' }}>
              {portion}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'stretch' }}>
        {/* Calories */}
        <div style={{
          flex: '1.1',
          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
          borderRadius: '10px',
          padding: '0.4rem',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 3px 8px rgba(109, 40, 217, 0.15)'
        }}>
          <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>พลังงานรวม</span>
          <span style={{ fontSize: '1.2rem', fontWeight: '800', margin: '1px 0' }}>{calories}</span>
          <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>kcal</span>
        </div>

        {/* Macros */}
        <div style={{
          flex: '2.5',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.3rem'
        }}>
          {/* Protein */}
          <div style={{
            background: '#fff1f2',
            border: '1px solid #ffe4e6',
            borderRadius: '8px',
            padding: '0.35rem 0.2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '0.9rem', marginBottom: '1px' }}>🥩</span>
            <span style={{ fontSize: '0.65rem', color: '#9f1239', fontWeight: 'bold' }}>โปรตีน</span>
            {editable ? (
              <input
                type="number"
                min="0"
                step="0.1"
                value={macroInputs.protein}
                onFocus={() => setFocusedMacro('protein')}
                onChange={(e) => handleMacroInput('protein', e.target.value)}
                onBlur={() => handleMacroBlur('protein')}
                style={{ ...macroInputStyle, color: '#be123c', margin: '2px 0' }}
              />
            ) : (
              <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#be123c', margin: '1px 0' }}>{protein}</span>
            )}
            <span style={{ fontSize: '0.6rem', color: '#be123c' }}>กรัม</span>
          </div>

          {/* Carbs */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #dcfce7',
            borderRadius: '8px',
            padding: '0.35rem 0.2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '0.9rem', marginBottom: '1px' }}>🍚</span>
            <span style={{ fontSize: '0.65rem', color: '#166534', fontWeight: 'bold' }}>คาร์บ</span>
            {editable ? (
              <input
                type="number"
                min="0"
                step="0.1"
                value={macroInputs.carbs}
                onFocus={() => setFocusedMacro('carbs')}
                onChange={(e) => handleMacroInput('carbs', e.target.value)}
                onBlur={() => handleMacroBlur('carbs')}
                style={{ ...macroInputStyle, color: '#15803d', margin: '2px 0' }}
              />
            ) : (
              <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#15803d', margin: '1px 0' }}>{carbs}</span>
            )}
            <span style={{ fontSize: '0.6rem', color: '#15803d' }}>กรัม</span>
          </div>

          {/* Fat */}
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: '8px',
            padding: '0.35rem 0.2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '0.9rem', marginBottom: '1px' }}>🥑</span>
            <span style={{ fontSize: '0.65rem', color: '#92400e', fontWeight: 'bold' }}>ไขมัน</span>
            {editable ? (
              <input
                type="number"
                min="0"
                step="0.1"
                value={macroInputs.fat}
                onFocus={() => setFocusedMacro('fat')}
                onChange={(e) => handleMacroInput('fat', e.target.value)}
                onBlur={() => handleMacroBlur('fat')}
                style={{ ...macroInputStyle, color: '#b45309', margin: '2px 0' }}
              />
            ) : (
              <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#b45309', margin: '1px 0' }}>{fat}</span>
            )}
            <span style={{ fontSize: '0.6rem', color: '#b45309' }}>กรัม</span>
          </div>
        </div>
      </div>
    </div>
  );
}
