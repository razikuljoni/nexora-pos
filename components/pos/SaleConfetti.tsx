'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2 } from 'lucide-react';

interface ParticlePreset {
  id: number;
  x: number; // percentage across viewport (4% to 96%)
  size: number;
  color: string;
  shape: 'rect' | 'circle' | 'strip' | 'diamond';
  duration: number;
  delay: number;
  swayX: [number, number, number, number];
  rotationZ: number;
  rotationX: number;
  rotationY: number;
}

interface SaleConfettiProps {
  isActive: boolean;
  orderNumber?: string;
  totalAmount?: string;
  onComplete?: () => void;
}

const CONFETTI_COLORS = [
  '#10B981', // Emerald
  '#34D399', // Mint
  '#38BDF8', // Sky
  '#60A5FA', // Light blue
  '#F59E0B', // Amber
  '#FBBF24', // Warm Gold
  '#EC4899', // Pink
  '#A855F7', // Purple
  '#F43F5E', // Rose
  '#14B8A6', // Teal
];

// Pure deterministic pseudo-random helper (seed-based, idempotent, zero impure calls)
function deterministic(seed: number): number {
  const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return v - Math.floor(v);
}

// Generate 40 deterministic particle presets at module load time
const PRESET_CONFETTI_PARTICLES: ParticlePreset[] = Array.from({ length: 40 }).map((_, i) => {
  const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
  const shapeTypes: ('rect' | 'circle' | 'strip' | 'diamond')[] = ['rect', 'circle', 'strip', 'diamond'];
  const shape = shapeTypes[i % shapeTypes.length];
  const r1 = deterministic(i * 3 + 1);
  const r2 = deterministic(i * 7 + 2);
  const r3 = deterministic(i * 11 + 3);
  const r4 = deterministic(i * 13 + 4);

  // Even horizontal distribution with organic offset
  const x = 5 + (i * 90) / 40 + (r1 * 4 - 2);
  const size = shape === 'strip' ? 12 : shape === 'circle' ? 7 : 8;
  const duration = 2.2 + r2 * 0.9; // 2.2s to 3.1s
  const delay = r3 * 0.35; // Staggered start 0s to 0.35s
  const drift = (r4 - 0.5) * 80;
  const swayX: [number, number, number, number] = [0, drift * 0.5, -drift * 0.6, drift];
  const rotationZ = (r1 > 0.5 ? 1 : -1) * (360 + r2 * 360);
  const rotationX = (r2 > 0.5 ? 1 : -1) * (360 + r3 * 180);
  const rotationY = (r3 > 0.5 ? 1 : -1) * (360 + r4 * 180);

  return {
    id: i,
    x: Math.round(x * 10) / 10,
    size,
    color,
    shape,
    duration: Math.round(duration * 100) / 100,
    delay: Math.round(delay * 100) / 100,
    swayX,
    rotationZ: Math.round(rotationZ),
    rotationX: Math.round(rotationX),
    rotationY: Math.round(rotationY),
  };
});

export const SaleConfetti: React.FC<SaleConfettiProps> = ({
  isActive,
  orderNumber,
  totalAmount,
  onComplete,
}) => {
  // Auto-dismiss after animation completes (3.4s)
  useEffect(() => {
    if (!isActive) return;

    const timer = setTimeout(() => {
      onComplete?.();
    }, 3400);

    return () => clearTimeout(timer);
  }, [isActive, onComplete]);

  return (
    <AnimatePresence>
      {isActive && (
        <div
          id="sale-success-confetti-container"
          className="fixed inset-0 pointer-events-none z-60 overflow-hidden"
          aria-hidden="true"
        >
          {/* Subtle Reinforcement Banner Pill */}
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/90 border border-emerald-500/40 text-white shadow-xl shadow-emerald-950/40 backdrop-blur-md"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="text-emerald-400 font-bold">Transaction Complete!</span>
              {orderNumber && (
                <span className="text-slate-400 font-mono text-[11px]">#{orderNumber}</span>
              )}
              {totalAmount && (
                <span className="text-white font-mono font-bold text-[11px] bg-slate-800 px-1.5 py-0.5 rounded">
                  {totalAmount}
                </span>
              )}
            </div>
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse ml-0.5" />
          </motion.div>

          {/* Confetti Particles */}
          {PRESET_CONFETTI_PARTICLES.map(particle => {
            return (
              <motion.div
                key={particle.id}
                initial={{
                  x: `${particle.x}vw`,
                  y: '-3vh',
                  opacity: 0,
                  rotateZ: 0,
                  rotateX: 0,
                  rotateY: 0,
                  scale: 0.6,
                }}
                animate={{
                  x: particle.swayX.map(s => `calc(${particle.x}vw + ${s}px)`),
                  y: ['-3vh', '105vh'],
                  opacity: [0, 1, 1, 0.8, 0],
                  rotateZ: particle.rotationZ,
                  rotateX: particle.rotationX,
                  rotateY: particle.rotationY,
                  scale: [0.6, 1, 0.95, 0.6],
                }}
                transition={{
                  duration: particle.duration,
                  delay: particle.delay,
                  ease: [0.25, 0.1, 0.25, 1],
                  times: [0, 0.08, 0.5, 0.85, 1],
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width:
                    particle.shape === 'strip'
                      ? particle.size * 0.4
                      : particle.shape === 'rect'
                      ? particle.size * 1.4
                      : particle.size,
                  height:
                    particle.shape === 'strip'
                      ? particle.size * 1.8
                      : particle.shape === 'rect'
                      ? particle.size * 0.7
                      : particle.size,
                  backgroundColor: particle.color,
                  borderRadius:
                    particle.shape === 'circle'
                      ? '50%'
                      : particle.shape === 'diamond'
                      ? '2px'
                      : '1.5px',
                  transform:
                    particle.shape === 'diamond' ? 'rotate(45deg)' : undefined,
                  boxShadow: `0 0 8px ${particle.color}33`,
                }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
};
