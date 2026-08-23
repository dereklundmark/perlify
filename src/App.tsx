import { AppProvider, useApp } from './state/AppContext';
import { Library } from './components/screens/Library';
import { Setup } from './components/screens/Setup';
import { Photo } from './components/screens/Photo';
import { ResultAdjust } from './components/screens/ResultAdjust';
import { FinalPreview } from './components/screens/FinalPreview';
import { Export } from './components/screens/Export';

function Screens() {
  const { state } = useApp();

  switch (state.screen) {
    case 'library':
      return <Library />;
    case 'setup':
      return <Setup />;
    case 'photo':
      return <Photo />;
    case 'adjust':
      return <ResultAdjust />;
    case 'preview':
      return <FinalPreview />;
    case 'export':
      return <Export />;
    default:
      return <Library />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <div className="app-shell">
        <Screens />
      </div>
    </AppProvider>
  );
}
