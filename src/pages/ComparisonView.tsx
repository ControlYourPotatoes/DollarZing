import React from 'react';
import { GameState } from '@/types/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ComparisonViewProps {
  gameState1: GameState;
  gameState2: GameState;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ gameState1, gameState2 }) => {
  const comparisonData = gameState1.chartData.map((item, index) => ({
    day: item.day,
    baseline: item.gamesPlayed,
    adjusted: gameState2.chartData[index]?.gamesPlayed || 0,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Simulation Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-bold">Baseline</h3>
              <p>Total Charity: ${gameState1.totalCharity.toFixed(2)}</p>
              <p>Jackpot Winners: {gameState1.jackpotWinners}</p>
              <p>Total Games: {gameState1.totalGamesPlayed}</p>
            </div>
            <div>
              <h3 className="font-bold">Adjusted</h3>
              <p>Total Charity: ${gameState2.totalCharity.toFixed(2)}</p>
              <p>Jackpot Winners: {gameState2.jackpotWinners}</p>
              <p>Total Games: {gameState2.totalGamesPlayed}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Games Played Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="baseline" fill="#8884d8" name="Baseline" />
              <Bar dataKey="adjusted" fill="#82ca9d" name="Adjusted" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComparisonView;