import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import useSimulationStore from '../store/SimulationStore';

const BaselineView: React.FC = () => {
  const { gameState1 } = useSimulationStore();

  const formatNumber = (num: number) => new Intl.NumberFormat().format(num);
  const formatCurrency = (num: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

  const KeyMetric = ({ label, value, previousValue }) => (
    <motion.div
      className="flex flex-col items-center p-4 bg-white rounded-lg shadow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-lg font-semibold text-gray-700">{label}</h3>
      <p className="text-3xl font-bold text-blue-600">{value}</p>
      {previousValue && (
        <div className="flex items-center mt-2">
          {value > previousValue ? (
            <ArrowUpIcon className="w-4 h-4 text-green-500" />
          ) : (
            <ArrowDownIcon className="w-4 h-4 text-red-500" />
          )}
          <span className="ml-1 text-sm text-gray-500">
            {((value - previousValue) / previousValue * 100).toFixed(2)}%
          </span>
        </div>
      )}
    </motion.div>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Baseline Simulation - Day {gameState1.day}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <KeyMetric 
            label="Active Players" 
            value={formatNumber(gameState1.activePlayers)}
            previousValue={gameState1.chartData[gameState1.chartData.length - 2]?.activePlayers}
          />
          <KeyMetric 
            label="Total Charity" 
            value={formatCurrency(gameState1.totalCharity)}
            previousValue={gameState1.chartData[gameState1.chartData.length - 2]?.charityContributions}
          />
          <KeyMetric 
            label="Platform Earnings" 
            value={formatCurrency(gameState1.platformEarnings)}
            previousValue={gameState1.chartData[gameState1.chartData.length - 2]?.platformEarnings}
          />
        </div>
        
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={gameState1.chartData.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="activePlayers" stroke="#8884d8" />
                <Line yAxisId="right" type="monotone" dataKey="gamesPlayed" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
          <TabsContent value="players">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[gameState1.chartData[gameState1.chartData.length - 1]]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="$1" fill="#8884d8" />
                <Bar dataKey="$2" fill="#82ca9d" />
                <Bar dataKey="$4" fill="#ffc658" />
                <Bar dataKey="$8" fill="#ff8042" />
                <Bar dataKey="$16" fill="#a4de6c" />
                {/* Add more bars for other levels as needed */}
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>
          <TabsContent value="financials">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={gameState1.chartData.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="charityContributions" stroke="#8884d8" />
                <Line type="monotone" dataKey="platformEarnings" stroke="#82ca9d" />
                <Line type="monotone" dataKey="governmentEarnings" stroke="#ffc658" />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default BaselineView;