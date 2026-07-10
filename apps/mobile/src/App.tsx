import { Navigate, Route, Routes } from 'react-router-dom'
import ConferenceSelectionScreen from './screens/ConferenceSelectionScreen'
import ReadyToScanScreen from './screens/ReadyToScanScreen'
import SignInScreen from './screens/SignInScreen'
import SplashScreen from './screens/SplashScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/sign-in" element={<SignInScreen />} />
      <Route path="/conference" element={<ConferenceSelectionScreen />} />
      <Route path="/ready" element={<ReadyToScanScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
