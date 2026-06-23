import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import QuizPage from './pages/QuizPage'
import HistoryPage from './pages/HistoryPage'

export default function App() {
  return (
    <div className="max-w-lg mx-auto min-h-screen bg-white shadow-lg relative">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/result" element={<QuizPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </div>
  )
}
