const { useState } = React;

const TABS = [
  { id: 'onboarding', label: '온보딩', num: '01', render: () => <window.OnboardingTab /> },
  { id: 'home', label: '홈', num: '02', render: () => <window.HomeTab /> },
  { id: 'compare', label: '비교', num: '03', render: () => <window.CompareTab /> },
  { id: 'detail', label: '항목 상세', num: '04', render: () => <window.DetailTab /> },
  { id: 'settings', label: '설정', num: '05', render: () => <window.SettingsTab /> },
];

function App() {
  const [active, setActive] = useState('compare');
  const tab = TABS.find((t) => t.id === active) || TABS[0];
  return (
    <>
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === active ? 'active' : ''}
            onClick={() => setActive(t.id)}
          >
            <span className="num">{t.num}</span>
            {t.label}
          </button>
        ))}
      </nav>
      <div data-screen-label={`Tab/${tab.label}`}>{tab.render()}</div>
    </>
  );
}

const navPlaceholder = document.getElementById('tabs');
const contentPlaceholder = document.getElementById('tab-content');
const mount = document.createElement('div');
navPlaceholder.replaceWith(mount);
contentPlaceholder.remove();
ReactDOM.createRoot(mount).render(<App />);
