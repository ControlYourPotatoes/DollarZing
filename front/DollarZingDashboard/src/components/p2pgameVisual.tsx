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


  const updateTotalPlayers = (newCount: number) => {
    setGameState1(prev => ({ ...prev, totalPlayers: newCount }));
    setGameState2(prev => ({ ...prev, totalPlayers: newCount }));
  };

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


  return (
    <div>
    {/* Container for the image and heading */}
    <div className="flex items-center justify-between mb-6">
      {/* Image */}
      <img 
        src="/src/assets/small_brand-remove.png" 
        alt="Logo" 
        className="h-16 w-auto object-contain"
        style={{ maxWidth: '480px' }}
      />
      {/* Centered Heading */}
      <h2 className="text-2xl text-black font-bold mx-auto">
        P2P Game Simulation Dashboard with {gameState.totalPlayers} users
      </h2>
    </div>
      <div className="grid grid-cols-2 md:grid-cols-2 gap-10 p-6">
        <div className='row-span-1'>

          <InfoCard 
              gameState={gameState1} 
              isRunning={isRunning} 
              updateTotalPlayers={updateTotalPlayers}
              toggleSimulation={() => setIsRunning(!isRunning)}
              cashOutStrategy={cashOutStrategy1}
              setCashOutStrategy={setCashOutStrategy1}
              adoptionRate={adoptionRate1}
              setAdoptionRate={setAdoptionRate1}
            />        
        </div>

        <div className='row-span-1 '>
          <div className='mt-40' >
            <ChartComponent data={gameState1.chartData} title="Simulation Distribution" />
          </div>
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

        <div className='row-span-1'>
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

