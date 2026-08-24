import { AppProvider, useApp } from './state/AppContext';
import { useIsTablet } from './hooks/useIsTablet';
import { Library } from './components/screens/Library';
import { Photo } from './components/screens/Photo';
import { ResultAdjust } from './components/screens/ResultAdjust';
import { FinalPreview } from './components/screens/FinalPreview';
import { Export } from './components/screens/Export';
import { ManualEdit } from './components/screens/ManualEdit';
import { CollectionEditor } from './components/screens/CollectionEditor';

function Screens() {
  const { state } = useApp();

  switch (state.screen) {
    case 'library':
      return <Library />;
    case 'photo':
      return <Photo />;
    case 'adjust':
      return <ResultAdjust />;
    case 'preview':
      return <FinalPreview />;
    case 'export':
      return <Export />;
    case 'edit':
      return <ManualEdit />;
    case 'collection':
      return <CollectionEditor />;
    default:
      return <Library />;
  }
}

/** Adjust/Edit break out of the phone-width shell on iPad — see EditorLayout. */
function Shell() {
  const { state } = useApp();
  const isTablet = useIsTablet();
  const isWideEditor = isTablet && (state.screen === 'adjust' || state.screen === 'edit');

  return (
    <div className={`app-shell${isWideEditor ? ' app-shell--wide' : ''}`}>
      <Screens />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
