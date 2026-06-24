import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { loadQuestions } from './db/loader'

// 应用启动时自动导入题库（幂等 — 已有数据则跳过）
loadQuestions()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/kappa">
      <App />
    </BrowserRouter>
  </StrictMode>,
)
