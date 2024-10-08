import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from "@/components/ui/slider";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CashOutStrategy } from '@/types/types';



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
    activePlayers: number;
    outreachPot: number;
  };
  isRunning: boolean;
  toggleSimulation: () => void;
  updateTotalPlayers: (players: number) => void;
  cashOutStrategy: CashOutStrategy;
  setCashOutStrategy: (strategy: CashOutStrategy) => void;
  resetSimulation: () => void;
}

interface CustomLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  index: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];


const InfoCard: React.FC<InfoCardProps> = ({ 
  gameState, 
  isRunning, 
  toggleSimulation, 
  updateTotalPlayers,
  resetSimulation
}) => {

  const handleSliderChange = (value: number[]) => {
    if (value.length > 0) {
      updateTotalPlayers(value[0]);
    }
  };

  const distributionData = [
    { name: 'Players', value: gameState.totalWinnings },
    { name: 'Government', value: gameState.governmentEarnings },
    { name: 'Charity', value: gameState.totalCharity },
  ];

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: CustomLabelProps) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
    );
  };

  const renderPieChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={distributionData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomizedLabel}
          outerRadius={95}
          fill="#8884d8"
          dataKey="value"
        >
          {distributionData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>

        <Tooltip 
          formatter={(value: number | string) => {
            if (typeof value === 'number') {
              return `$${value.toFixed(2)}`;
            }
            return value;
          }}
        />
        <Legend layout="vertical" wrapperStyle={{ bottom: -15, right: 120, backgroundColor: '#f5f5f5', border: '1px solid #d5d5d5', borderRadius: 3, padding: 5}} />
      </PieChart>
    </ResponsiveContainer>
  );



  return (
    <Card className="bg-blue-100 p-6 rounded-lg shadow-lg dark:bg-surface-dark dark:text-white">
      <CardContent>
        <div className="flex">
          {/* Left side: Information */}
          <div className="flex-1 pr-4">
            <div>
              <h1 className="text-lg text-gray-500">Day</h1>
              <p className="text-2xl font-bold text-gray-900">{gameState.day} / 30</p>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">Total Charity</p>
              <p className="text-lg font-bold text-green-500">${gameState.totalCharity.toFixed(2)}</p>
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-500">Total $512 Winners</p>
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
              <p className="text-sm text-gray-500">Outreach Pot</p>
              <p className="text-lg font-bold text-purple-500">${gameState.outreachPot.toFixed(2)}</p>
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-500">Total Player Winnings</p>
              <p className="text-lg font-bold text-gray-900">${gameState.totalWinnings.toFixed(2)}</p>
            </div>
            <div className="mt-2">
              <div className="mt-4 flex justify-between items-center">
                <p className="text-sm text-gray-500">Total Players</p>
                <p className="text-lg font-bold text-gray-900">{gameState.totalPlayers}</p>
              </div>
              <div className="mt-2 flex justify-between items-center">
                <p className="text-sm text-gray-500">Active Players</p>
                <p className="text-lg font-bold text-blue-500">{gameState.activePlayers}</p>
              </div>
            </div>
          </div>

          {/* Right side: Pie Chart */}
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-2 pl-20">Distribution</p>
            {renderPieChart()}
          </div>
        </div>

        {/* Bottom: Slider and Button */}
        <div className="mt-4">
          <Slider
            min={1000}
            max={100000}
            step={15}
            value={[gameState.totalPlayers]}
            onValueChange={handleSliderChange}
            className="mt-2"
          />
        </div>
        <div className="mt-4 flex justify-center">
        <button
            onClick={toggleSimulation}
            className={`px-4 py-2 rounded-md text-white ${
              isRunning
                ? 'bg-red-500 dark:bg-red-700'
                : 'bg-green-500 dark:bg-green-700'
            }`}
          >
            {isRunning ? 'Stop Simulation' : 'Start Simulation'}
          </button>
          <button
            onClick={resetSimulation}
            className="px-4 py-2 rounded-md text-white bg-blue-500 dark:bg-blue-700"
          >
            Reset Simulation
          </button>
        </div>
      </CardContent>
    </Card>
  );
};


export default InfoCard;