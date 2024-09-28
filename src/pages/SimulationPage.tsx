import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/NavBar';
import BaselineView from './BaselineView';
import AdjustedView from './AdjustedView';
import ComparisonView from './ComparisonView';
import useSimulationStore from '../store/SimulationStore';

type View = 'baseline' | 'adjusted' | 'comparison';

const SimulationPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('baseline');
  const { gameState1, gameState2 } = useSimulationStore();

  const pageVariants = {
    initial: { opacity: 0, x: "-100%" },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: "100%" }
  };

  const pageTransition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.5
  };

  const renderView = () => {
    switch (currentView) {
      case 'baseline':
        return <BaselineView />;
      case 'adjusted':
        return <AdjustedView gameState={gameState2} />;
      case 'comparison':
        return <ComparisonView gameState1={gameState1} gameState2={gameState2} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />
      <div className="p-4 w-full max-w-custom mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SimulationPage;