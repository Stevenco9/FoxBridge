import packageJson from '../package.json'
import './App.css'

function App() {
  return (
    <main className="app">
      <div className="app__content">
        <h1 className="app__title">FoxBridge</h1>
        <p className="app__version">Version {packageJson.version}</p>
        <p className="app__tagline">Desktop companion for RegFox</p>

        <div className="status">
          <span className="status__indicator" aria-hidden="true" />
          <span className="status__label">Application Running</span>
        </div>
      </div>
    </main>
  )
}

export default App
