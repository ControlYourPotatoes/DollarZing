import { useState, useEffect, useCallback } from 'react';
import InfoCard from './InfoCard';
import ChartComponent from './DistributionChart';
import ComparisonChartComponent from './ComparisonChart';
import AdjustableChartComponent from './AdjustableChart';
import { GameState, ChartDataPoint, CashOutStrategy } from '@/types/types';

const LEVELS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
const PLATFORM_FEE = 0.20;
const GOVERNMENT_SHARE = 0.40;
const CHARITY_SHARE = 0.20;
const PLAYER_SHARE = 0.40;
const OUTREACH_POT_PER_GAME = 0.01;
const PANAMA_LOTTERY_USERS = 1000000; // Assuming 1 million users

const logDetailedSimulation = (
  dailyGamesPlayed: number,
  cashOutStrategy: CashOutStrategy,
  levelData: Record<string, number>,
  dailyPlayerWinnings: number,
  dailyGovernmentEarnings: number,
  dailyCharity: number
) => {
  console.log(`\n--- Detailed Simulation Log ---`);
  console.log(`Strategy: ${cashOutStrategy}`);
  console.log(`Total Games Played: ${dailyGamesPlayed}`);
  
  let totalCalculatedGames = 0;
  let totalCalculatedWinnings = 0;

  // Use the same getCashOutProbability logic as in simulateDay
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

  LEVELS.forEach((level, _) => {
    const gamesAtLevel = levelData[`$${level}`] || 0;
    totalCalculatedGames += gamesAtLevel;
    const winnersAtLevel = Math.floor(gamesAtLevel / 2);
    const cashOutProbability = getCashOutProbability(level, cashOutStrategy);
    const cashOutWinners = Math.floor(winnersAtLevel * cashOutProbability);
    const winningsAtLevel = cashOutWinners * level * 2;
    totalCalculatedWinnings += winningsAtLevel;

    console.log(`Level ${level}:`);
    console.log(`  Games: ${gamesAtLevel}`);
    console.log(`  Winners: ${winnersAtLevel}`);
    console.log(`  Cash-out Probability: ${cashOutProbability.toFixed(2)}`);
    console.log(`  Cash-out Winners: ${cashOutWinners}`);
    console.log(`  Winnings: $${winningsAtLevel.toFixed(2)}`);
  });

  console.log(`\nTotal Calculated Games: ${totalCalculatedGames}`);
  console.log(`Total Calculated Winnings: $${totalCalculatedWinnings.toFixed(2)}`);
  console.log(`Actual Total Winnings: $${(dailyPlayerWinnings + dailyGovernmentEarnings + dailyCharity).toFixed(2)}`);
  console.log(`Discrepancy: $${(totalCalculatedWinnings - (dailyPlayerWinnings + dailyGovernmentEarnings + dailyCharity)).toFixed(2)}`);
  console.log(`--- End of Detailed Log ---\n`);
};


// Initial game state
const initialGameState: GameState = {
  day: 0,
  totalCharity: 0,
  chartData: [],
  jackpotWinners: 0,
  totalGamesPlayed: 0,
  platformEarnings: 0,
  totalWinnings: 0,
  totalPlayers: 1000,
  activePlayers: 1000,
  outreachPot: 0,
  governmentEarnings: 0,
  weeklyStats: []
};

// Type for the simulateDay function
type SimulateDayFunction = (
  prevState: GameState,
  cashOutStrategy: CashOutStrategy,
  adoptionRate: number
) => GameState;





const GameSimulation = () => {
  //Initialize game state
  
  // Initialize simulation state
  const [gameState1, setGameState1] = useState<GameState>(initialGameState);
  const [gameState2, setGameState2] = useState<GameState>(initialGameState);
  const [isRunning, setIsRunning] = useState(false);
  const [cashOutStrategy1, setCashOutStrategy1] = useState<CashOutStrategy>('average');
  const [cashOutStrategy2, setCashOutStrategy2] = useState<CashOutStrategy>('average');
  const [adoptionRate2, setAdoptionRate2] = useState(0.001);

  const resetSimulation = useCallback(() => {
    setGameState1(initialGameState);
    setGameState2(initialGameState);
    setIsRunning(false);
    setCashOutStrategy1('average');
    setCashOutStrategy2('high');
    setAdoptionRate2(0.001);
  }, []);

  const getBillsPerDay = (strategy: CashOutStrategy): number => {
    const getRandomInt = (min: number, max: number): number => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };
  
    switch (strategy) {
      case 'low':
        return getRandomInt(1, 4);
      case 'average':
        return getRandomInt(5, 7);
      case 'high':
        return getRandomInt(8, 12);
      default:
        return getRandomInt(5, 7); // Default to average if strategy is not recognized
    }
  };
  


  // Main function to simulate a single day
  const simulateDay: SimulateDayFunction = useCallback((
    prevState: GameState,
    cashOutStrategy: CashOutStrategy,
    adoptionRate: number
  ): GameState => {

    // Check if the simulation has reached the end
    if (prevState.day >= 30) return prevState;

    const newDay = prevState.day + 1;
    
  // Calculate new active players based on adoption rate
  let newActivePlayers;
    if (adoptionRate === 0 || adoptionRate === undefined) {
      // Natural growth with randomness and overall upward trend
      const baseGrowthRate = 0.01; // 1% daily base growth
      const randomFactor = (Math.random() + 0.5) * 0.05; // Random factor between 0.5% and 1.0%
      const timeFactorb = Math.log(newDay + 1) / 10; // Logarithmic time factor for gradual slowdown
      const effectiveGrowthRate = (baseGrowthRate + randomFactor) * (1 + timeFactorb);
      newActivePlayers = Math.floor(prevState.activePlayers * (1 + effectiveGrowthRate));
    } else {
      // Adoption rate growth with randomness
      const baseAdoptedUsers = Math.floor(PANAMA_LOTTERY_USERS * adoptionRate);
      const randomFactor = Math.floor(Math.random() * baseAdoptedUsers * 0.2) - Math.floor(baseAdoptedUsers * 0.1);
      const adoptedPanamaUsers = baseAdoptedUsers + randomFactor;
      newActivePlayers = Math.min(
        PANAMA_LOTTERY_USERS,
        prevState.activePlayers + adoptedPanamaUsers
      );
    }

    console.log(`Day ${newDay}: ${adoptionRate === 0 ? 'Natural' : 'Adoption'} growth - Total players: ${prevState.totalPlayers}, Active players: ${newActivePlayers}, Cashout strategy: ${cashOutStrategy}`, );
    
    
    // Calculate daily games played using cash out strategy
    const billsPerDay = getBillsPerDay(cashOutStrategy);
    const averageBet = billsPerDay; // Assuming $1 per bill
    const totalBet = newActivePlayers * averageBet;

    
    // Initialize daily totals
    let remainingPot = totalBet;
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
    LEVELS.forEach((level) => {
      const potentialWinnersAtLevel = Math.floor(remainingPot / (level * 2));
      const gamesAtLevel = potentialWinnersAtLevel * 2; // Total games at this level
      const cashOutProbability = getCashOutProbability(level, cashOutStrategy);
      const cashOutWinners = Math.floor(potentialWinnersAtLevel * cashOutProbability);
      const payoutAtLevel = Math.min(cashOutWinners * level * 2, remainingPot);
  
      // Calculate platform earnings and outreach pot for this level
      dailyPlatformEarnings += gamesAtLevel * PLATFORM_FEE;
      dailyOutreachPot += gamesAtLevel * OUTREACH_POT_PER_GAME;
  
      // Distribute winnings
      const playerShare = payoutAtLevel * PLAYER_SHARE;
      const governmentShare = payoutAtLevel * GOVERNMENT_SHARE;
      const charityShare = payoutAtLevel * CHARITY_SHARE;
  
      dailyPlayerWinnings += playerShare;
      dailyGovernmentEarnings += governmentShare;
      dailyCharity += charityShare;
  
      if (level === 512) {
        dailyJackpotWinners += cashOutWinners;
      }
  
      remainingPot -= payoutAtLevel;
      levelData[`$${level}`] = gamesAtLevel;
    });
  
    const totalDailyGames = Object.values(levelData).reduce((sum, games) => sum + games, 0);

    const newChartDataPoint: ChartDataPoint = {
      day: newDay,
      charityContributions: dailyCharity,
      platformEarnings: dailyPlatformEarnings,
      jackpotWinners: dailyJackpotWinners,
      gamesPlayed: totalDailyGames,
      totalPlayers: prevState.totalPlayers,
      activePlayers: newActivePlayers,
      governmentEarnings: dailyGovernmentEarnings,
      outreachPot: dailyOutreachPot,
      playerWinnings: dailyPlayerWinnings,
      ...levelData
    };

    logDetailedSimulation(
      totalDailyGames,
      cashOutStrategy,
      levelData,
      dailyPlayerWinnings,
      dailyGovernmentEarnings,
      dailyCharity
    );

  return {
    day: newDay,
    totalCharity: prevState.totalCharity + dailyCharity,
    chartData: [...prevState.chartData, newChartDataPoint],
    jackpotWinners: prevState.jackpotWinners + dailyJackpotWinners,
    totalGamesPlayed: prevState.totalGamesPlayed + totalDailyGames,
    platformEarnings: prevState.platformEarnings + dailyPlatformEarnings,
    governmentEarnings: prevState.governmentEarnings + dailyGovernmentEarnings,
    outreachPot: (prevState.outreachPot || 0) + dailyOutreachPot,
    totalWinnings: prevState.totalWinnings + dailyPlayerWinnings,
    totalPlayers: prevState.totalPlayers,
    activePlayers: newActivePlayers
  };
}, []);


  // Function to update total players (baseline) from user input
  const updateTotalPlayers = (newCount: number) => {
    setGameState1(prev => ({ ...prev, totalPlayers: newCount, activePlayers: newCount }));
    setGameState2(prev => ({ ...prev, totalPlayers: newCount, activePlayers: newCount }));
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning) {
      timer = setInterval(() => {
        setGameState1((prevState) => simulateDay(prevState, cashOutStrategy1, 0)); // Always 0 for natural growth
        setGameState2((prevState) => simulateDay(prevState, cashOutStrategy2, adoptionRate2));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, simulateDay, cashOutStrategy1, cashOutStrategy2, adoptionRate2]);


  return (
    <div>
    {/* Container for the image and heading */}
    <div className="flex items-center justify-between mb-6">
      {/* Image */}
      <img 
        src="@/small_brand-remove.png" 
        alt="Logo" 
        className="h-16 w-auto object-contain"
        style={{ maxWidth: '480px' }}
      />
      {/* Centered Heading */}
      <h2 className="text-2xl text-black font-bold mx-auto">
        P2P Game Simulation Dashboard with {gameState1.totalPlayers} users
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
              resetSimulation={resetSimulation}
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

