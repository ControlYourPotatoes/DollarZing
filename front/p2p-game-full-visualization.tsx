import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const LEVELS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
const TOTAL_PLAYERS = 3000;
const TOTAL_DAYS = 100;
const PLATFORM_FEE = 0.10;
const BILLS_PER_DAY = 7;
const AVG_DONATION_PERCENTAGE = 0.125; // 12.5% average donation

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

// Mock data for initial render
const initialChartData = [
  {
    day: 1,
    charityContributions: 1000,
    platformEarnings: 500,
    jackpotWinners: 1,
    gamesPlayed: 5000,
    ...LEVELS.reduce((acc, level, index) => ({ ...acc, [`$${level}`]: 500 - index * 50 }), {})
  }
];

const GameSimulation = () => {
  const [gameState, setGameState] = useState({
    day: 0,
    totalCharity: 1000,
    chartData: initialChartData,
    jackpotWinners: 1,
    totalGamesPlayed: 5000,
    platformEarnings: 500,
    totalWinnings: 10000,
  });

  const [selectedChart, setSelectedChart] = useState('bar');
  const [selectedMetric, setSelectedMetric] = useState('playerLevels');
  const [isRunning, setIsRunning] = useState(false);

  const simulateDay = () => {
    if (gameState.day >= TOTAL_DAYS) {
      setIsRunning(false);
      return;
    }

    setGameState(prevState => {
      const newDay = prevState.day + 1;
      const activePlayers = TOTAL_PLAYERS * (Math.random() * 0.2 + 0.8);
      const dailyGamesPlayed = Math.floor(activePlayers * BILLS_PER_DAY / 2);
      const dailyPlatformEarnings = dailyGamesPlayed * PLATFORM_FEE * 2;
      
      let dailyWinnings = 0;
      let dailyCharity = 0;
      let dailyJackpotWinners = 0;
      
      const levelData = LEVELS.reduce((acc, level) => {
        const gamesAtLevel = Math.floor(dailyGamesPlayed / Math.pow(2, LEVELS.indexOf(level)));
        const winnersAtLevel = Math.floor(gamesAtLevel / 2);
        
        if (level === 512) {
          const jackpotWinnings = winnersAtLevel * 1024;
          dailyWinnings += jackpotWinnings;
          dailyCharity += jackpotWinnings * AVG_DONATION_PERCENTAGE;
          dailyJackpotWinners += winnersAtLevel;
        } else {
          const cashOutWinners = Math.floor(winnersAtLevel * 0.5);
          const cashOutWinnings = cashOutWinners * level * 2;
          dailyWinnings += cashOutWinnings;
          dailyCharity += cashOutWinnings * AVG_DONATION_PERCENTAGE;
        }

        acc[`$${level}`] = gamesAtLevel;
        return acc;
      }, {});

      const newChartData = [...prevState.chartData, {
        day: newDay,
        charityContributions: dailyCharity,
        platformEarnings: dailyPlatformEarnings,
        jackpotWinners: dailyJackpotWinners,
        gamesPlayed: dailyGamesPlayed,
        ...levelData
      }];

      return {
        day: newDay,
        totalCharity: prevState.totalCharity + dailyCharity,
        chartData: newChartData,
        jackpotWinners: prevState.jackpotWinners + dailyJackpotWinners,
        totalGamesPlayed: prevState.totalGamesPlayed + dailyGamesPlayed,
        platformEarnings: prevState.platformEarnings + dailyPlatformEarnings,
        totalWinnings: prevState.totalWinnings + dailyWinnings,
      };
    });
  };

  useEffect(() => {
    let timer;
    if (isRunning) {
      timer = setInterval(simulateDay, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning]);

  const renderChart = () => {
    const Chart = selectedChart === 'bar' ? BarChart : selectedChart === 'line' ? LineChart : AreaChart;
    const DataComponent = selectedChart === 'bar' ? Bar : selectedChart === 'line' ? Line : Area;

    return (
      <Chart data={gameState.chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" />
        <YAxis />
        <Tooltip />
        <Legend />
        {selectedMetric === 'playerLevels' && 
          LEVELS.map((level, index) => (
            <DataComponent key={level} type="monotone" dataKey={`$${level}`} stackId="1" stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} />
          ))
        }
        {selectedMetric === 'earnings' && (
          <DataComponent type="monotone" dataKey="platformEarnings" stroke="#82ca9d" fill="#82ca9d" />
        )}
        {selectedMetric === 'charity' && (
          <DataComponent type="monotone" dataKey="charityContributions" stroke="#8884d8" fill="#8884d8" />
        )}
      </Chart>
    );
  };

  const renderPieChart = () => {
    const data = [
      { name: 'Charity Donations', value: gameState.totalCharity },
      { name: 'Platform Earnings', value: gameState.platformEarnings },
      { name: 'Player Winnings', value: gameState.totalWinnings - gameState.totalCharity }
    ];
    return (
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    );
  };

  return (
    <div className="p-4 max-w-6xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
      <h2 className="text-2xl font-bold mb-4">P2P Game Simulation Dashboard (3,000 Players)</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p>Day: {gameState.day} / {TOTAL_DAYS}</p>
          <p>Total Charity: ${gameState.totalCharity.toFixed(2)}</p>
          <p>Total $1,024 Winners: {gameState.jackpotWinners}</p>
          <p>Total Games Played: {gameState.totalGamesPlayed}</p>
          <p>Total Platform Earnings: ${gameState.platformEarnings.toFixed(2)}</p>
          <p>Total Winnings: ${gameState.totalWinnings.toFixed(2)}</p>
          <p>Charity Percentage: {(gameState.totalCharity / gameState.totalWinnings * 100).toFixed(2)}%</p>
        </div>
        <div>
          <button 
            onClick={() => setIsRunning(!isRunning)} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {isRunning ? 'Pause' : 'Start'} Simulation
          </button>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="font-bold">Visualization Controls:</h3>
        <div className="flex space-x-4">
          <select 
            value={selectedChart} 
            onChange={(e) => setSelectedChart(e.target.value)}
            className="border rounded p-2"
          >
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="area">Area Chart</option>
          </select>
          <select 
            value={selectedMetric} 
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="border rounded p-2"
          >
            <option value="playerLevels">Player Levels</option>
            <option value="earnings">Platform Earnings</option>
            <option value="charity">Charity Contributions</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="h-96">
          <h3 className="font-bold mb-2">Time Series Data:</h3>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
        <div className="h-96">
          <h3 className="font-bold mb-2">Financial Distribution:</h3>
          <ResponsiveContainer width="100%" height="100%">
            {renderPieChart()}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default GameSimulation;
