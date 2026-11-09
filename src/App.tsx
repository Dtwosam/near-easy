import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ActivityPage } from './pages/Activity';
import { AssistantPage } from './pages/Assistant';
import { ExplorePage } from './pages/Explore';
import { FundingPage } from './pages/Funding';
import { HomePage } from './pages/Home';
import { RoadmapPage } from './pages/Roadmap';
import { SettingsPage } from './pages/Settings';
import { StakingPage } from './pages/Staking';
import { WalletPage } from './pages/Wallet';
import { Shell } from './shell';
import { StoreProvider } from './store';
import { useTitle } from './ui';

function MissingPage() {
  useTitle('Page not found');
  return (
    <div className="page">
      <h1 className="page-title">That page is not here</h1>
      <p className="lede">The link does not match a NEAR Easy page.</p>
      <Link to="/" className="btn btn-primary">
        Back to home
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/funding" element={<FundingPage />} />
            <Route path="/staking" element={<StakingPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/roadmap" element={<RoadmapPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<MissingPage />} />
          </Routes>
        </Shell>
      </BrowserRouter>
    </StoreProvider>
  );
}
