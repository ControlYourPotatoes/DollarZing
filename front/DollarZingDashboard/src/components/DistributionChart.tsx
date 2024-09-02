import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BarChart as BarChartIcon, LineChart as LineChartIcon, AreaChart as AreaChartIcon } from 'lucide-react'

// Define the structure of our data
interface ChartDataPoint {
    day: number;
    [key: string]: number | string; // This allows for dynamic metric keys
  }
  
  // Define the props for our component
  interface ChartComponentProps {
    data: ChartDataPoint[];
    title: string;
    metricKey: string;
  }
  
  // Define the possible chart types
  type ChartType = 'bar' | 'line' | 'area';
  
  // Define the possible cash-out strategies
  type CashOutStrategy = 'low' | 'average' | 'high';

  const ChartComponent: React.FC<ChartComponentProps> = ({ data, title, metricKey }) => {
    const [chartType, setChartType] = useState<ChartType>('bar');
    const [cashOutStrategy, setCashOutStrategy] = useState<CashOutStrategy>('average');
  
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
          <DataComponent type="monotone" dataKey={metricKey} stroke="#8884d8" fill="#8884d8" />
        </Chart>
      );
    };

    return (
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
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
              <Select onValueChange={(value: CashOutStrategy) => setCashOutStrategy(value)} defaultValue={cashOutStrategy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select cash-out strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Risk</SelectItem>
                  <SelectItem value="average">Average Risk</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                </SelectContent>
              </Select>
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
    
    export default ChartComponent;