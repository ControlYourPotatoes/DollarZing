import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const LEVELS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
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
  //Initialize game state
  const [gameState, setGameState] = useState({
    day: 0,
    totalCharity: 0,
    chartData: [initialChartData],
    jackpotWinners: 1,
    totalGamesPlayed: 0,
    platformEarnings: 500,
    totalWinnings: 10000,
    totalPlayers: 1000
  });

  //States for the chart selection options
  const [selectedChart, setSelectedChart] = useState('bar');
  const [selectedMetric, setSelectedMetric] = useState('playerLevels');
  const [isRunning, setIsRunning] = useState(false);

  // Calculate the number of active players each day
  const calculateActivePlayers = (totalPlayers: number) => {
    return Math.floor(totalPlayers * (Math.random() * 0.2 + 0.8));
  };

  // Calculate the number of games played each day
  const calculateDailyGamesPlayed = (activePlayers: number) => {
    return Math.floor(activePlayers * BILLS_PER_DAY / 2);
  };

  // Calculate platform earnings based on games played
  const calculatePlatformEarnings = (dailyGamesPlayed: number) => {
    return dailyGamesPlayed * PLATFORM_FEE * 2;
  };

// Calculate winnings, charity contributions, and winners for each level
const calculateLevelData = (dailyGamesPlayed: number, cashOutStrategy: 'low' | 'average' | 'high') => {
  let dailyWinnings = 0;
  let dailyCharity = 0;
  let dailyJackpotWinners = 0;

  const levelData = LEVELS.reduce((acc, level) => {
    const gamesAtLevel = Math.floor(dailyGamesPlayed / Math.pow(2, LEVELS.indexOf(level)));
    const winnersAtLevel = Math.floor(gamesAtLevel / 2);

    let cashOutProbability: number;

    // Adjust cash-out probability based on strategy
    switch (cashOutStrategy) {
      case 'low':
        // Higher probability of cashing out at lower levels
        cashOutProbability = level <= 4 ? 0.9 : 0.3;
        break;
      case 'high':
        // Higher probability of cashing out at higher levels
        cashOutProbability = level >= 64 ? 0.8 : 0.1;
        break;
      case 'average':
      default:
        // Current average behavior
        cashOutProbability = 0.5;
        break;
    }

    const cashOutWinners = Math.floor(winnersAtLevel * cashOutProbability);
    const cashOutWinnings = cashOutWinners * level * 2;
    dailyWinnings += cashOutWinnings;
    dailyCharity += cashOutWinnings * AVG_DONATION_PERCENTAGE;

    if (level === 512) {
      const jackpotWinnings = winnersAtLevel * 1024;
      dailyWinnings += jackpotWinnings;
      dailyCharity += jackpotWinnings * AVG_DONATION_PERCENTAGE;
      dailyJackpotWinners += winnersAtLevel;
    }

    acc[`$${level}`] = gamesAtLevel;
    return acc;
  }, {});

  return { levelData, dailyWinnings, dailyCharity, dailyJackpotWinners };
};


  // Main function to simulate a single day
  const simulateDay = () => {
    setGameState(prevState => {
      if (prevState.day >= TOTAL_DAYS) {
        setIsRunning(false);
        return prevState;
      }

      const newDay = prevState.day + 1;
      const activePlayers = calculateActivePlayers(prevState.totalPlayers);
      const dailyGamesPlayed = calculateDailyGamesPlayed(activePlayers);
      const dailyPlatformEarnings = calculatePlatformEarnings(dailyGamesPlayed);
      const { levelData, dailyWinnings, dailyCharity, dailyJackpotWinners } = calculateLevelData(dailyGamesPlayed, 'average');

      // Update game state with new calculations
      const newChartData = [
        ...prevState.chartData,
        {
          day: newDay,
          charityContributions: dailyCharity,
          platformEarnings: dailyPlatformEarnings,
          jackpotWinners: dailyJackpotWinners,
          gamesPlayed: dailyGamesPlayed,
          ...levelData
        }
      ];

      return {
        day: newDay,
        totalCharity: prevState.totalCharity + dailyCharity,
        chartData: newChartData,
        jackpotWinners: prevState.jackpotWinners + dailyJackpotWinners,
        totalGamesPlayed: prevState.totalGamesPlayed + dailyGamesPlayed,
        platformEarnings: prevState.platformEarnings + dailyPlatformEarnings,
        totalWinnings: prevState.totalWinnings + dailyWinnings,
        totalPlayers: prevState.totalPlayers
      };
    });
  };

  // Function to update the number of total players based on slider input
  const updateTotalPlayers = (newPlayerCount: number) => {
    setGameState(prevState => ({
      ...prevState,
      totalPlayers: newPlayerCount,
    }));
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
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

  const InfoCard: React.FC<{ gameState, isRunning, toggleSimulation }> = ({ gameState, isRunning, toggleSimulation }) => {
    return (
      <div className="bg-grey p-6 rounded-lg shadow-lg w-50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg text-gray-500">Day</h1>
            <p className="text-2xl font-bold text-gray-900">{gameState.day} / {TOTAL_DAYS}</p>
          </div>
          <button
            onClick={toggleSimulation}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            {isRunning ? 'Pause' : 'Start'} Simulation
          </button>
        </div>
        <div className="mt-4">
          <p className="text-sm text-gray-500">Total Charity</p>
          <p className="text-lg font-bold text-green-500">${gameState.totalCharity.toFixed(2)}</p>
        </div>
        <div className="mt-2">
          <p className="text-sm text-gray-500">Total $1,024 Winners</p>
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
          <p className="text-sm text-gray-500">Total Winnings</p>
          <p className="text-lg font-bold text-gray-900">${gameState.totalWinnings.toFixed(2)}</p>
        </div>
        <div className="mt-4 flex items-center">
          <p className="text-sm text-gray-500">Charity Percentage</p>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden ml-2">
            <div className="h-full bg-teal-500" style={{ width: `${(gameState.totalCharity / gameState.totalWinnings * 100).toFixed(2)}%` }}></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div >
      <h2 className="text-2xl font-bold mb-6">P2P Game Simulation Dashboard with {gameState.totalPlayers} users</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
        <div>
          <InfoCard gameState={gameState} isRunning={isRunning} toggleSimulation={() => setIsRunning(!isRunning)} />
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
