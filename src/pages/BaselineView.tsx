import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import useSimulationStore from '../store/SimulationStore';
import BaseChart from '@/components/BaseChart';

const BaselineView: React.FC = () => {
  const { gameState1 } = useSimulationStore();
  const [selectedTab, setSelectedTab] = useState('overview');

  const formatNumber = (num: number) => new Intl.NumberFormat().format(num);
  const formatCurrency = (num: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

  useEffect(() => {
    console.log('BaselineView: gameState1 updated', gameState1);
  }, [gameState1]);

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === undefined || previous === null) return null;
    if (previous === 0 && current === 0) return 0;
    if (previous === 0) return 100; // Avoid division by zero
    return ((current - previous) / previous) * 100;
  };

  const KeyMetric = ({ label, value, previousValue, metricType }) => {
    const growth = calculateGrowth(value, previousValue);
    const formattedGrowth = growth !== null ? growth.toFixed(2) : 'N/A';

    console.log(`${label}: Current = ${value}, Previous = ${previousValue}, Growth = ${formattedGrowth}`);


    return (
      <div className="flex flex-col items-center p-4 bg-gray-200 rounded-lg shadow w-fit">
        <h3 className="text-lg font-semibold text-gray-700">{label}</h3>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-3xl font-bold text-blue-500">
            {metricType === 'currency' ? formatCurrency(value) : formatNumber(value)}
          </p>
          {growth !== null && (
            <div className="flex justify-center mt-2">
              {growth > 0 ? (
                <ArrowUpIcon className="w-4 h-4 text-green-500" />
              ) : growth < 0 ? (
                <ArrowDownIcon className="w-4 h-4 text-red-500" />
              ) : (
                <span className="w-4 h-4">-</span>
              )}
              <span className="ml-1 text-sm text-gray-500">
                {formattedGrowth}%
              </span>
            </div>
          )}
        </motion.div>
      </div>
    );
  };

  const getPreviousValue = (key: string) => {
    const prevDay = gameState1.chartData[gameState1.chartData.length - 2];
    return prevDay ? prevDay[key] : undefined;
  };

  return (
    <Card className="w-full px-6">
      <CardHeader>
        <CardTitle className='text-xl text-center'>Baseline Simulation - Day {gameState1.day}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-grow justify-center gap-4 mb-6">
        <KeyMetric 
            label="Active Players" 
            value={gameState1.activePlayers}
            previousValue={getPreviousValue('activePlayers')}
            metricType="number"
          />
          <KeyMetric 
            label="Total Charity" 
            value={gameState1.totalCharity}
            previousValue={getPreviousValue('charityContributions')}
            metricType="currency"
          />
          <KeyMetric 
            label="Platform Earnings" 
            value={gameState1.platformEarnings}
            previousValue={getPreviousValue('platformEarnings')}
            metricType="currency"
          />
          <KeyMetric
            label="Government Earnings"
            value={gameState1.governmentEarnings}
            previousValue={getPreviousValue('governmentEarnings')}
            metricType="currency"
          />
          <KeyMetric 
            label="Total Games" 
            value={gameState1.totalGamesPlayed}
            previousValue={getPreviousValue('gamesPlayed')}
            metricType="number"
          />
        </div>
        
        <Tabs defaultValue="overview" onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <BaseChart selectedTab={selectedTab} />
          </TabsContent>
          <TabsContent value="players">
            <BaseChart selectedTab={selectedTab} />
          </TabsContent>
          <TabsContent value="financials">
            <BaseChart selectedTab={selectedTab} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default BaselineView;