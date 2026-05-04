import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import MultiplayerApp from './MultiplayerApp'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {window.location.pathname === '/' || window.location.pathname.startsWith('/game/') ? <MultiplayerApp /> : <App />}
  </React.StrictMode>,
)
