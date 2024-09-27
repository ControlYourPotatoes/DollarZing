import React from 'react';
import { GameState } from '@/types/types';
import InfoCard from '../components/InfoCard';
import ChartComponent from '../components/DistributionChart';

interface BaselineViewProps {
  gameState: GameState;
}

const BaselineView: React.FC<BaselineViewProps> = ({ gameState }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <InfoCard gameState={gameState} />
      <ChartComponent data={gameState.chartData} title="Simulation Distribution" />
    </div>
  );
};

export default BaselineView;