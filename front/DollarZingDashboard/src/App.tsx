import { useState } from 'react'
import GameSimulation from './components/p2pgameVisual'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <GameSimulation />
      </div>
    </>
  )
}

export default App
