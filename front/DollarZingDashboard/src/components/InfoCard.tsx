import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from "@/components/ui/slider";


interface InfoCardProps {
  gameState: {
    day: number;
    totalCharity: number;
    jackpotWinners: number;
    totalGamesPlayed: number;
    platformEarnings: number;
    totalWinnings: number;
    totalPlayers: number;
    governmentEarnings: number;
  };
  isRunning: boolean;
  toggleSimulation: () => void;
  updateTotalPlayers: (players: number) => void;
}

const InfoCard: React.FC<InfoCardProps> = ({ 
  gameState, 
  isRunning, 
  toggleSimulation, 
  updateTotalPlayers 
}) => {

  const handleSliderChange = (value: number[]) => {
    if (value.length > 0) {
      updateTotalPlayers(value[0]);
    }
  };

  
  return (
    <Card className="bg-blue-100 p-6 rounded-lg shadow-lg dark:bg-surface-dark dark:text-white">
      <CardContent>
        <div>
          <h1 className="text-lg text-gray-500">Day</h1>
          <p className="text-2xl font-bold text-gray-900">{gameState.day} / 30</p>
        </div>
        <div className="mt-4">
          <p className="text-sm text-gray-500">Total Charity</p>
          <p className="text-lg font-bold text-green-500">${gameState.totalCharity.toFixed(2)}</p>
        </div>
        <div className="mt-2">
          <p className="text-sm text-gray-500">Total $1,024 Winners</p>
          <p className="text-lg font-bold text-gray-900">{gameState.jackpotWinners}</p>
        </div>
        <div className="mt-2">
          <p className="text-sm text-gray-500">Total Games Played</p>
          <p className="text-lg font-bold text-gray-900">{gameState.totalGamesPlayed}</p>
        </div>
        <div className="mt-2">
          <p className="text-sm text-gray-500">Platform Earnings</p>
          <p className="text-lg font-bold text-indigo-500">${gameState.platformEarnings.toFixed(2)}</p>
        </div>
        <div className="mt-2">
          <p className="text-sm text-gray-500">Government Earnings</p>
          <p className="text-lg font-bold text-orange-500">${gameState.governmentEarnings.toFixed(2)}</p>
        </div>
        <div className="mt-2">
          <p className="text-sm text-gray-500">Total Winnings</p>
          <p className="text-lg font-bold text-gray-900">${gameState.totalWinnings.toFixed(2)}</p>
        </div>
        <div className="mt-2">
          <p className="text-sm text-gray-500">Charity Percentage</p>
          <p className="text-lg font-bold text-teal-500">
            {(gameState.totalCharity / gameState.totalWinnings * 100).toFixed(2)}%
          </p>
        </div>
        <div className="mt-2">
          <div className="mt-4 flex justify-between items-center">
            <p className="text-sm text-gray-500">Total Players</p>
            <p className="text-lg font-bold text-gray-900">{gameState.totalPlayers}</p>
          </div>
          <Slider
            min={100}
            max={10000}
            step={25}
            value={[gameState.totalPlayers]}
            onValueChange={handleSliderChange}
            className="mt-2"
          />
        </div>
        <div className="mt-4 flex justify-center">
          <button
            onClick={toggleSimulation}
            className={`bg-${isRunning ? 'red' : 'green'}-500 text-white px-4 py-2 rounded-md`}
          >
            {isRunning ? 'Stop Simulation' : 'Start Simulation'}
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InfoCard;