import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AppPage from './pages/AppPage';
import Cursor from './components/Cursor';
import TransitionOverlay from './components/TransitionOverlay';

export default function App() {
  return (
    <BrowserRouter>
      <Cursor />
      <TransitionOverlay />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<AppPage />} />
      </Routes>
    </BrowserRouter>
  );
}
