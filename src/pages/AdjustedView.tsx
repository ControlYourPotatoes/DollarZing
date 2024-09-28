import React from 'react';
import { GameState } from '@/types/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AdjustedViewProps {
  gameState: GameState;
}

const AdjustedView: React.FC<AdjustedViewProps> = ({ gameState }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Adjusted Simulation Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Day: {gameState.day}</p>
          <p>Total Charity: ${gameState.totalCharity.toFixed(2)}</p>
          <p>Jackpot Winners: {gameState.jackpotWinners}</p>
          <p>Total Games Played: {gameState.totalGamesPlayed}</p>
          <p>Platform Earnings: ${gameState.platformEarnings.toFixed(2)}</p>
          <p>Active Players: {gameState.activePlayers}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adjusted Active Players Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={gameState.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="activePlayers" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdjustedView;