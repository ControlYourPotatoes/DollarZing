import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import InfoCard from './InfoCard';
import ChartComponent from './DistributionChart';

const LEVELS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
const TOTAL_DAYS = 30;
const PLATFORM_FEE = 0.10;
const BILLS_PER_DAY = 7;
const AVG_DONATION_PERCENTAGE = 0.125; // 12.5% average donation
const governmentSharePerGame = 0.01; // 5% of the game fee goes to the government

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

interface GameState {
  day: number;
  totalCharity: number;
  chartData: any[];
  jackpotWinners: number;
  totalGamesPlayed: number;
  platformEarnings: number;
  totalWinnings: number;
  totalPlayers: number;
  governmentEarnings: number;
}

type CashOutStrategy = 'low' | 'average' | 'high';

const GameSimulation = () => {
  //Initialize game state
  const [gameState, setGameState] = useState<GameState>({
    day: 0,
    totalCharity: 0,
    chartData: [],
    jackpotWinners: 1,
    totalGamesPlayed: 0,
    platformEarnings: 0,
    totalWinnings: 10000,
    totalPlayers: 1000,
    governmentEarnings: 0
  });

  // Initialize simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [cashOutStrategy, setCashOutStrategy] = useState<CashOutStrategy>('average');
  const [adoptionRate, setAdoptionRate] = useState(0.01); 

  // Calculate the number of active players each day
  const calculateActivePlayers = (totalPlayers: number) => {
    return Math.floor(totalPlayers * (Math.random() * 0.2 + 0.8));
  };

  // Calculate the number of games played each day
  const calculateDailyGamesPlayed = (activePlayers: number) => {
    return Math.floor(activePlayers * BILLS_PER_DAY / 2);
  };

  const calculateGovernmentEarnings = (dailyGamesPlayed: number) => {
    return dailyGamesPlayed * governmentSharePerGame;
  };

  // Calculate platform earnings based on games played
  const calculatePlatformEarnings = (dailyGamesPlayed: number) => {
    const totalPlatformFee = dailyGamesPlayed * PLATFORM_FEE * 2;
    const governmentShare = dailyGamesPlayed * governmentSharePerGame;
    return totalPlatformFee - governmentShare;
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
  const simulateDay = useCallback((prevState: GameState): GameState => {
      if (prevState.day >= TOTAL_DAYS) {
        return prevState;
      }
  
      const newDay = prevState.day + 1;
      
      // Simulate user growth based on adoption rate
      const newTotalPlayers = Math.floor(prevState.totalPlayers * (1 + adoptionRate));
      
      const activePlayers = calculateActivePlayers(newTotalPlayers);
      const dailyGamesPlayed = calculateDailyGamesPlayed(activePlayers);
      const dailyPlatformEarnings = calculatePlatformEarnings(dailyGamesPlayed);
      const dailyGovernmentEarnings = calculateGovernmentEarnings(dailyGamesPlayed);
      
      const { levelData, dailyWinnings, dailyCharity, dailyJackpotWinners } = calculateLevelData(dailyGamesPlayed, cashOutStrategy);
  
      const newChartData = [
        ...prevState.chartData,
        {
          day: newDay,
          charityContributions: dailyCharity,
          platformEarnings: dailyPlatformEarnings,
          jackpotWinners: dailyJackpotWinners,
          gamesPlayed: dailyGamesPlayed,
          totalPlayers: newTotalPlayers,
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
        governmentEarnings: prevState.governmentEarnings + dailyGovernmentEarnings,
        totalWinnings: prevState.totalWinnings + dailyWinnings,
        totalPlayers: newTotalPlayers
      };
    }, [cashOutStrategy, adoptionRate]);

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
      timer = setInterval(() => {
        setGameState(prevState => simulateDay(prevState));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, simulateDay]);


  

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
    <div>
      <h2 className="text-2xl text-black font-bold mb-6">P2P Game Simulation Dashboard with {gameState.totalPlayers} users</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-2 gap-10 p-6">
        <div>
          <InfoCard gameState={gameState} isRunning={isRunning} updateTotalPlayers={updateTotalPlayers} toggleSimulation={() => setIsRunning(!isRunning)} />
        </div>

        <div>
          <ChartComponent 
            data={gameState.chartData} 
            title="Financial Distribution" 
            metricKey="platformEarnings" 
          />
        </div>
        

        
      </div>



    </div>
  );
};

export default GameSimulation;

