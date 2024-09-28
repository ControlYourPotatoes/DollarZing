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
    console.log('SimulationEngine: isRunning changed to', isRunning);
    let timer: NodeJS.Timeout;
    if (isRunning) {
      console.log('Starting simulation');
      timer = setInterval(() => {
        console.log('Running simulation step');
        const newGameState1 = simulateDay(gameState1, { cashOutStrategy: cashOutStrategy1, adoptionRate: 0 });
        const newGameState2 = simulateDay(gameState2, { cashOutStrategy: cashOutStrategy2, adoptionRate: adoptionRate2 });
        
        setGameState1(newGameState1);
        setGameState2(newGameState2);
      }, 1000); // Run simulation every second
    } else {
      console.log('Stopping simulation');
    }
    return () => {
      if (timer) {
        clearInterval(timer);
        console.log('Cleared simulation interval');
      }
    };
  }, [isRunning, simulateDay, setGameState1, setGameState2, cashOutStrategy1, cashOutStrategy2, adoptionRate2, gameState1, gameState2]);

  return null;
};


export default SimulationEngine;