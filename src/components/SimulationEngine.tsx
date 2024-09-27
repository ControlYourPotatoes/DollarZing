import React, { useEffect } from 'react';
import useSimulationStore from '../store/SimulationStore';

const SimulationEngine: React.FC = () => {
  const {
    isRunning,
    simulateDay,
    setGameState1,
    setGameState2,
    cashOutStrategy1,
    cashOutStrategy2,
    adoptionRate2,
    gameState1,
    gameState2
  } = useSimulationStore();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning) {
      timer = setInterval(() => {
        const newGameState1 = simulateDay(gameState1, { cashOutStrategy: cashOutStrategy1, adoptionRate: 0 });
        setGameState1(newGameState1);

        const newGameState2 = simulateDay(gameState2, { cashOutStrategy: cashOutStrategy2, adoptionRate: adoptionRate2 });
        setGameState2(newGameState2);
      }, 1000); // Run simulation every second
    }
    return () => clearInterval(timer);
  }, [isRunning, simulateDay, setGameState1, setGameState2, cashOutStrategy1, cashOutStrategy2, adoptionRate2, gameState1, gameState2]);

  return null; // This component doesn't render anything
};

export default SimulationEngine;