import { useState, useEffect, useCallback } from 'react';
import InfoCard from './InfoCard';
import ChartComponent from './DistributionChart';
import ComparisonChartComponent from './ComparisonChart';
import AdjustableChartComponent from './AdjustableChart';
import { GameState, ChartDataPoint, CashOutStrategy } from '@/types/types';

const LEVELS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
const PLATFORM_FEE = 0.10;
const GOVERNMENT_SHARE = 0.40;
const CHARITY_SHARE = 0.20;
const PLAYER_SHARE = 0.40;
const OUTREACH_POT_PER_GAME = 0.01;

const PANAMA_LOTTERY_USERS = 1000000; // Assuming 1 million users
const BILLS_PER_DAY = 5;

// const TOTAL_DAYS = 30;





// Initial game state
const initialGameState: GameState = {
  day: 0,
  totalCharity: 0,
  chartData: [],
  jackpotWinners: 0,
  totalGamesPlayed: 0,
  platformEarnings: 0,
  totalWinnings: 0,
  totalPlayers: 1000, // Starting with 1000 players
  activePlayers: 0,
  outreachPot: 0,
  governmentEarnings: 0
};

// Type for the simulateDay function
type SimulateDayFunction = (
  prevState: GameState,
  cashOutStrategy: CashOutStrategy,
  adoptionRate: number
) => GameState;


const GameSimulation = () => {
  //Initialize game state
  const [gameState] = useState<GameState>({
    day: 0,
    totalCharity: 0,
    chartData: [],
    jackpotWinners: 1,
    totalGamesPlayed: 0,
    platformEarnings: 0,
    totalWinnings: 10000,
    totalPlayers: 1000,
    activePlayers: 0,
    governmentEarnings: 0,
    outreachPot: 0,
  });

  // Initialize simulation state
  const [gameState1, setGameState1] = useState<GameState>(initialGameState);
  const [gameState2, setGameState2] = useState<GameState>(initialGameState);
  const [isRunning, setIsRunning] = useState(false);
  const [cashOutStrategy1, setCashOutStrategy1] = useState<CashOutStrategy>('average');
  const [cashOutStrategy2, setCashOutStrategy2] = useState<CashOutStrategy>('average');
  const [adoptionRate1, setAdoptionRate1] = useState(0.01);
  const [adoptionRate2, setAdoptionRate2] = useState(0.05);

  // // Calculate the number of active players each day
  // const calculateActivePlayers = (totalPlayers: number) => {
  //   return Math.floor(totalPlayers * (Math.random() * 0.2 + 0.8));
  // };

  // // Calculate the number of games played each day
  // const calculateDailyGamesPlayed = (activePlayers: number) => {
  //   return Math.floor(activePlayers * BILLS_PER_DAY / 2);
  // };

  // const calculateGovernmentEarnings = (dailyGamesPlayed: number) => {
  //   return dailyGamesPlayed * governmentSharePerGame;
  // };

  // // Calculate platform earnings based on games played
  // const calculatePlatformEarnings = (dailyGamesPlayed: number) => {
  //   const totalPlatformFee = dailyGamesPlayed * PLATFORM_FEE * 2;
  //   return totalPlatformFee;
  // };

  // // Calculate winnings, charity contributions, and winners for each level
  // const calculateLevelData = (dailyGamesPlayed: number, cashOutStrategy: CashOutStrategy) => {
  //   let dailyWinnings = 0;
  //   let dailyCharity = 0;
  //   let dailyJackpotWinners = 0;
  
  //   const levelData = LEVELS.reduce((acc, level) => {
  //     const gamesAtLevel = Math.floor(dailyGamesPlayed / Math.pow(2, LEVELS.indexOf(level)));
  //     const winnersAtLevel = Math.floor(gamesAtLevel / 2);
  
  //     let cashOutProbability: number;
  //     switch (cashOutStrategy) {
  //       case 'low':
  //         cashOutProbability = level <= 4 ? 0.9 : 0.3;
  //         break;
  //       case 'high':
  //         cashOutProbability = level >= 64 ? 0.8 : 0.1;
  //         break;
  //       case 'average':
  //       default:
  //         cashOutProbability = 0.5;
  //         break;
  //     }
  
  //     const cashOutWinners = Math.floor(winnersAtLevel * cashOutProbability);
  //     const cashOutWinnings = cashOutWinners * level * 2;
  //     dailyWinnings += cashOutWinnings;
  //     dailyCharity += cashOutWinnings * AVG_DONATION_PERCENTAGE;
  
  //     if (level === 512) {
  //       const jackpotWinnings = winnersAtLevel * 1024;
  //       dailyWinnings += jackpotWinnings;
  //       dailyCharity += jackpotWinnings * AVG_DONATION_PERCENTAGE;
  //       dailyJackpotWinners += winnersAtLevel;
  //     }
  
  //     acc[`$${level}`] = gamesAtLevel;
  //     return acc;
  //   }, {} as Record<string, number>);
  
  //   return { levelData, dailyWinnings, dailyCharity, dailyJackpotWinners };
  // };

  // Main function to simulate a single day
  const simulateDay: SimulateDayFunction = useCallback((
    prevState: GameState,
    cashOutStrategy: CashOutStrategy,
    adoptionRate: number
  ): GameState => {
    if (prevState.day >= 30) return prevState;

    const newDay = prevState.day + 1;
    
    // Simulate user growth, and Calculate new total players and active players
    const potentialActivePlayers = Math.min(
      PANAMA_LOTTERY_USERS,
      Math.floor(prevState.totalPlayers * (1 + adoptionRate))
    );
    const activePlayerPercentage = 0.2 + (0.6 * (1 - Math.exp(-newDay / 10))); // Starts at 20%, asymptotically approaches 80%
    const activePlayers = Math.floor(potentialActivePlayers * activePlayerPercentage);
    
    // Calculate daily games played using BILLS_PER_DAY
    const dailyGamesPlayed = Math.floor(activePlayers * BILLS_PER_DAY / 2);
    
    // Initialize daily totals
    let dailyCharity = 0;
    let dailyPlatformEarnings = 0;
    let dailyGovernmentEarnings = 0;
    let dailyOutreachPot = 0;
    let dailyPlayerWinnings = 0;
    let dailyJackpotWinners = 0;
    const levelData: Record<string, number> = {};

    // Function to get cash-out probability based on strategy and level
    const getCashOutProbability = (level: number, strategy: CashOutStrategy): number => {
      switch (strategy) {
        case 'low':
          return Math.max(0.9 - (level / 100), 0.1);
        case 'average':
          return 0.5;
        case 'high':
          return Math.min(0.1 + (level / 100), 0.9);
      }
    };
    // Simulate games for each level
  LEVELS.forEach((level, index) => {
    const gamesAtLevel = Math.floor(dailyGamesPlayed / Math.pow(2, index));
    const winnersAtLevel = Math.floor(gamesAtLevel / 2);
    const cashOutProbability = getCashOutProbability(level, cashOutStrategy);
    const cashOutWinners = Math.floor(winnersAtLevel * cashOutProbability);
    const totalWinningsAtLevel = cashOutWinners * level * 2;

    // Distribute winnings
    dailyPlayerWinnings += totalWinningsAtLevel * PLAYER_SHARE;
    dailyGovernmentEarnings += totalWinningsAtLevel * GOVERNMENT_SHARE;
    dailyCharity += totalWinningsAtLevel * CHARITY_SHARE;

    // Platform earnings and outreach pot
    dailyPlatformEarnings += gamesAtLevel * PLATFORM_FEE;
    dailyOutreachPot += gamesAtLevel * OUTREACH_POT_PER_GAME;

    if (level === 512) {
      dailyJackpotWinners += cashOutWinners;
    }

    levelData[`$${level}`] = gamesAtLevel;
  });

  const newChartDataPoint: ChartDataPoint = {
    day: newDay,
    charityContributions: dailyCharity,
    platformEarnings: dailyPlatformEarnings,
    jackpotWinners: dailyJackpotWinners,
    gamesPlayed: dailyGamesPlayed,
    totalPlayers: prevState.totalPlayers,
    activePlayers,
    governmentEarnings: dailyGovernmentEarnings,
    outreachPot: dailyOutreachPot,
    playerWinnings: dailyPlayerWinnings,
    ...levelData
  };

  return {
    day: newDay,
    totalCharity: prevState.totalCharity + dailyCharity,
    chartData: [...prevState.chartData, newChartDataPoint],
    jackpotWinners: prevState.jackpotWinners + dailyJackpotWinners,
    totalGamesPlayed: prevState.totalGamesPlayed + dailyGamesPlayed,
    platformEarnings: prevState.platformEarnings + dailyPlatformEarnings,
    governmentEarnings: prevState.governmentEarnings + dailyGovernmentEarnings,
    outreachPot: (prevState.outreachPot || 0) + dailyOutreachPot,
    totalWinnings: prevState.totalWinnings + dailyPlayerWinnings,
    totalPlayers: prevState.totalPlayers,
    activePlayers
  };
}, []);


  // // Function to update the number of total players based on slider input
  // const updateTotalPlayers = (newPlayerCount: number) => {
  //   setGameState(prevState => ({
  //     ...prevState,
  //     totalPlayers: newPlayerCount,
  //   }));
  // };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning) {
      timer = setInterval(() => {
        setGameState1((prevState) => simulateDay(prevState, cashOutStrategy1, adoptionRate1));
        setGameState2((prevState) => simulateDay(prevState, cashOutStrategy2, adoptionRate2));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, simulateDay, cashOutStrategy1, cashOutStrategy2, adoptionRate1, adoptionRate2]);



  

  // const renderPieChart = () => {
  //   const data = [
  //     { name: 'Charity Donations', value: gameState.totalCharity },
  //     { name: 'Platform Earnings', value: gameState.platformEarnings },
  //     { name: 'Player Winnings', value: gameState.totalWinnings - gameState.totalCharity }
  //   ];
  //   return (
  //     <PieChart>
  //       <Pie
  //         data={data}
  //         cx="50%"
  //         cy="50%"
  //         labelLine={false}
  //         outerRadius={80}
  //         fill="#8884d8"
  //         dataKey="value"
  //         label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
  //       >
  //         {data.map((entry, index) => (
  //           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
  //         ))}
  //       </Pie>
  //       <Tooltip />
  //       <Legend />
  //     </PieChart>
  //   );
  // };


  return (
    <div>
      <h2 className="text-2xl text-black font-bold mb-6">P2P Game Simulation Dashboard with {gameState.totalPlayers} users</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-2 gap-10 p-6">
        <div className=''>
          <InfoCard 
              gameState={gameState1} 
              isRunning={isRunning} 
              updateTotalPlayers={(newCount: number) => setGameState1(prev => ({ ...prev, totalPlayers: newCount }))}
              toggleSimulation={() => setIsRunning(!isRunning)}
              cashOutStrategy={cashOutStrategy1}
              setCashOutStrategy={setCashOutStrategy1}
              adoptionRate={adoptionRate1}
              setAdoptionRate={setAdoptionRate1}
            />        
        </div>

        <div className='flex flex-col justify-center items-center'>
          <ChartComponent 
            data={gameState1.chartData} 
            title="Financial Distribution"  
          />

          
        </div>


        

          <div>
            <AdjustableChartComponent 
            data={gameState2.chartData} 
            title="Adjustable Simulation"
            cashOutStrategy={cashOutStrategy2}
            setCashOutStrategy={setCashOutStrategy2}
            adoptionRate={adoptionRate2}
            setAdoptionRate={setAdoptionRate2}
            totalPlayers={gameState2.totalPlayers}
          />
          </div>
          <div className='flex items-center'>
            <ComparisonChartComponent 
            data1={gameState1.chartData}
            data2={gameState2.chartData}
            title="Comparison Chart"
          />
          </div>
          
        

        

        
      </div>



    </div>
  );
};

export default GameSimulation;

