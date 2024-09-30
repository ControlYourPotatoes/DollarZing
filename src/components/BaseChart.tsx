import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card"
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BarChart as BarChartIcon, LineChart as LineChartIcon, AreaChart as AreaChartIcon } from 'lucide-react'
import useSimulationStore from '../store/SimulationStore';

interface BaseChartProps {
  selectedTab: string;
}


const BaseChart: React.FC<BaseChartProps> = ({ selectedTab }) => {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('line');
  const { gameState1 } = useSimulationStore();

  const CustomTooltip = ({ active, payload, label, tab }) => {
    if (active && payload && payload.length) {
      switch (tab) {
        case 'overview':
          return (
            <div className="custom-tooltip bg-white p-4 border border-gray-200 rounded shadow-md">
              <p className="label font-bold">{`Day: ${label}`}</p>
              <p className="text-blue-600">{`Active Players: ${payload[0].value}`}</p>
              <p className="text-green-600">{`Games Played: ${payload[1].value}`}</p>
            </div>
          );
        case 'players':
            const data = payload[0].payload;
            return (
              <div className="custom-tooltip bg-white p-4 border border-green-200 rounded shadow-md ml-10">
                <p className="label font-bold">{`Level: $${data.level}`}</p>
                <p className="text-purple-600">{`Games Played: ${data.gamesAtLevel}`}</p>
                <p className="text-green-600">{`Cash Out Players: ${data.cashOutPlayers}`}</p>
                <p className="text-red-600">{`Losing Players: ${data.losingPlayers}`}</p>
                <hr className="border-t-2 border-green-600 my-2" />
                <p className="text-blue-600">{`Platform Earnings: $${data.platformEarnings.toFixed(2)}`}</p>
                <p className="text-green-500">{`Charity Contribution: $${data.charityContribution.toFixed(2)}`}</p>
                <p className="text-orange-400">{`Government Earnings: $${data.governmentEarnings.toFixed(2)}`}</p>
              </div>
            );
        case 'financials':
          return (
            <div className="custom-tooltip bg-white p-4 border border-gray-200 rounded shadow-md">
              <p className="label font-bold">{`Day: ${label}`}</p>
              {payload.map((entry, index) => (
                <p key={index} style={{ color: entry.color }}>{`${entry.name}: $${entry.value.toFixed(2)}`}</p>
              ))}
            </div>
          );
        default:
          return null;
      }
    }
    return null;
  };

  const renderOverviewChart = () => {
    const ChartComponent = chartType === 'bar' ? BarChart : LineChart;
    const DataComponent = chartType === 'bar' ? Bar : Line;

    return (
      <ChartComponent data={gameState1.chartData.slice(-30)}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip content={<CustomTooltip tab="overview" />} />
        <Legend />
        <DataComponent yAxisId="left" type="monotone" dataKey="activePlayers" stroke="#8884d8" fill="#8884d8" />
        <DataComponent yAxisId="right" type="monotone" dataKey="gamesPlayed" stroke="#82ca9d" fill="#82ca9d" />
      </ChartComponent>
    );
  };

  const renderPlayersChart = () => {
    return (
      <BarChart data={gameState1.currentDayLevelData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="level" tickFormatter={(value) => `$${value}`} />
        <YAxis />
        <Tooltip content={<CustomTooltip tab="players" />} />
        <Legend />
        <Bar dataKey="charityContribution"  fill="#0ca80c"  name="Charity" />
        <Bar dataKey="governmentEarnings" fill="#ffc658"  name="Government" />
        <Bar dataKey="platformEarnings" fill="#2563eb" name="Platform" />
      </BarChart>
    );
  };

  const renderFinancialsChart = () => {
    const ChartComponent = chartType === 'bar' ? BarChart : chartType === 'line' ? LineChart : AreaChart;
    const DataComponent = chartType === 'bar' ? Bar : chartType === 'line' ? Line : Area;

    return (
      <ChartComponent data={gameState1.chartData.slice(-30)}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" />
        <YAxis />
        <Tooltip content={<CustomTooltip tab="financials" />} />
        <Legend />
        <DataComponent type="monotone" dataKey="charityContributions" stroke="#8884d8" fill="#8884d8" />
        <DataComponent type="monotone" dataKey="platformEarnings" stroke="#82ca9d" fill="#82ca9d" />
        <DataComponent type="monotone" dataKey="governmentEarnings" stroke="#ffc658" fill="#ffc658" />
      </ChartComponent>
    );
  };

  const renderChart = () => {
    switch (selectedTab) {
      case 'overview':
        return renderOverviewChart();
      case 'players':
        return renderPlayersChart();
      case 'financials':
        return renderFinancialsChart();
      default:
        return null;
    }
  };

  const renderChartTypeToggle = () => {
    if (selectedTab === 'players') return null;

    const options = selectedTab === 'overview'
      ? [{ value: 'bar', icon: BarChartIcon }, { value: 'line', icon: LineChartIcon }]
      : [{ value: 'bar', icon: BarChartIcon }, { value: 'line', icon: LineChartIcon }, { value: 'area', icon: AreaChartIcon }];

    return (
      <ToggleGroup type="single" value={chartType} onValueChange={(value: 'bar' | 'line' | 'area') => value && setChartType(value)}>
        {options.map(({ value, icon: Icon }) => (
          <ToggleGroupItem key={value} value={value} aria-label={`${value} Chart`}>
            <Icon className="h-5 w-5" />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  };

  return (
    <Card>
      <CardContent>
        <div className="flex justify-left mt-3 mb-4">
          {renderChartTypeToggle()}
        </div>
        <ResponsiveContainer width="95%" height={450}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default BaseChart;