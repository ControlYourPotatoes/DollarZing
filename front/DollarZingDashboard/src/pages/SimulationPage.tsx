import React from 'react';
import GameSimulation from '../components/p2pgameVisual'; // Adjust the path if needed

const SimulationPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-4 w-full max-w-custom bg-white rounded-xl shadow-md overflow-hidden">
        <GameSimulation />
      </div>
    </div>
  );
};

export default SimulationPage;