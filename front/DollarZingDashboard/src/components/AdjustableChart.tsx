import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Slider } from "@/components/ui/slider"
import { BarChart as BarChartIcon, LineChart as LineChartIcon, AreaChart as AreaChartIcon } from 'lucide-react'

export interface ChartDataPoint {
  day: number;
  charityContributions: number;
  platformEarnings: number;
  jackpotWinners: number;
  gamesPlayed: number;
  totalPlayers: number;
  [key: string]: number;
}

interface AdjustableChartComponentProps {
  data: ChartDataPoint[];
  title: string;
  cashOutStrategy: string;
  setCashOutStrategy: (strategy: string) => void;
  adoptionRate: number;
  setAdoptionRate: (rate: number) => void;
}

type ChartType = 'bar' | 'line' | 'area';

const LEVELS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

const AdjustableChartComponent: React.FC<AdjustableChartComponentProps> = ({
  data,
  title,
  cashOutStrategy,
  setCashOutStrategy,
  adoptionRate,
  setAdoptionRate
}) => {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [selectedMetric, setSelectedMetric] = useState<string>('platformEarnings');

  const metricOptions = [
    { value: 'playerLevels', label: 'Player Levels Distribution' },
    { value: 'platformEarnings', label: 'Platform Earnings' },
    { value: 'charityContributions', label: 'Charity Contributions' },
    { value: 'jackpotWinners', label: 'Jackpot Winners' },
    { value: 'gamesPlayed', label: 'Games Played' },
    { value: 'totalPlayers', label: 'Total Players' },
  ];

  const renderChart = () => {
    const Chart = chartType === 'bar' ? BarChart : chartType === 'line' ? LineChart : AreaChart;
    const DataComponent = chartType === 'bar' ? Bar : chartType === 'line' ? Line : Area;

    return (
      <Chart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" />
        <YAxis />
        <Tooltip />
        <Legend />
        {selectedMetric === 'playerLevels' 
          ? LEVELS.map((level, index) => (
              <DataComponent
                key={level}
                type="monotone"
                dataKey={`$${level}`}
                stackId="1"
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
              />
            ))
          : <DataComponent type="monotone" dataKey={selectedMetric} fill="#8884d8" stroke="#8884d8" />
        }
      </Chart>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <ToggleGroup type="single" value={chartType} onValueChange={(value: ChartType) => value && setChartType(value)}>
              <ToggleGroupItem value="bar" aria-label="Bar Chart">
                <BarChartIcon className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="line" aria-label="Line Chart">
                <LineChartIcon className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="area" aria-label="Area Chart">
                <AreaChartIcon className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Select onValueChange={setSelectedMetric} defaultValue={selectedMetric}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                {metricOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between items-center">
            <Select onValueChange={setCashOutStrategy} value={cashOutStrategy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Cash-out strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="average">Average Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
              <span>Adoption Rate:</span>
              <Slider
                min={0}
                max={10}
                step={0.1}
                value={[adoptionRate * 100]}
                onValueChange={(value) => setAdoptionRate(value[0] / 100)}
                className="w-[200px]"
              />
              <span>{(adoptionRate * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default AdjustableChartComponent;