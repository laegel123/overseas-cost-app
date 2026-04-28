// Shared: Phone shell, status bar, bottom tabs, icons, helpers.

const StatusIcons = () => (
  <div className="icons">
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
      <rect x="0" y="6" width="3" height="4" rx="0.5" fill="#11263C"/>
      <rect x="4" y="4" width="3" height="6" rx="0.5" fill="#11263C"/>
      <rect x="8" y="2" width="3" height="8" rx="0.5" fill="#11263C"/>
      <rect x="12" y="0" width="3" height="10" rx="0.5" fill="#11263C"/>
    </svg>
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
      <path d="M7 2.5C9 2.5 10.7 3.3 12 4.5L13 3.5C11.4 1.9 9.3 1 7 1C4.7 1 2.6 1.9 1 3.5L2 4.5C3.3 3.3 5 2.5 7 2.5Z" fill="#11263C"/>
      <path d="M7 5.5C8.2 5.5 9.2 6 10 6.7L11 5.7C9.9 4.7 8.5 4 7 4C5.5 4 4.1 4.7 3 5.7L4 6.7C4.8 6 5.8 5.5 7 5.5Z" fill="#11263C"/>
      <circle cx="7" cy="8.5" r="1" fill="#11263C"/>
    </svg>
    <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
      <rect x="0.5" y="0.5" width="19" height="10" rx="2.5" stroke="#11263C" strokeOpacity="0.4" fill="none"/>
      <rect x="2" y="2" width="16" height="7" rx="1.5" fill="#11263C"/>
      <path d="M21 3.5V7.5C21.6 7.3 22 6.7 22 5.5C22 4.3 21.6 3.7 21 3.5Z" fill="#11263C" fillOpacity="0.4"/>
    </svg>
  </div>
);

const Phone = ({ children, w = 320, h = 680 }) => (
  <div className="phone" style={{ width: w, height: h }}>
    <div className="screen">
      <div className="statusbar">
        <span>9:41</span>
        <StatusIcons />
      </div>
      {children}
    </div>
  </div>
);

const PhoneStage = ({ tag, anno, children }) => (
  <div className="stage">
    <div className="phone-wrap">
      <div className="phone-tag">{tag}</div>
      {children}
    </div>
    {anno ? <div className="stage-anno">{anno}</div> : null}
  </div>
);

// Icon set (line, 22px viewBox)
const Icon = ({ name, size = 22, color = "currentColor", stroke = 1.8 }) => {
  const s = { width: size, height: size, fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "home":
      return <svg viewBox="0 0 24 24" {...s}><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>;
    case "compare":
      return <svg viewBox="0 0 24 24" {...s}><path d="M5 4v16M5 8l4-4M5 8l4 4M19 20V4M19 16l-4 4M19 16l-4-4"/></svg>;
    case "star":
      return <svg viewBox="0 0 24 24" {...s}><path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9z"/></svg>;
    case "settings":
      return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case "search":
      return <svg viewBox="0 0 24 24" {...s}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case "back":
      return <svg viewBox="0 0 24 24" {...s}><path d="M15 18l-6-6 6-6"/></svg>;
    case "more":
      return <svg viewBox="0 0 24 24" {...s}><circle cx="6" cy="12" r="1.5" fill={color} stroke="none"/><circle cx="12" cy="12" r="1.5" fill={color} stroke="none"/><circle cx="18" cy="12" r="1.5" fill={color} stroke="none"/></svg>;
    case "house":
      return <svg viewBox="0 0 24 24" {...s}><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-16a1 1 0 0 1-1-1z"/><path d="M9 22V12h6v10"/></svg>;
    case "fork":
      return <svg viewBox="0 0 24 24" {...s}><path d="M5 3v6a3 3 0 0 0 3 3v9M11 3v6M8 6V3"/><path d="M19 3v18M15 7c0-2 2-4 4-4"/></svg>;
    case "bus":
      return <svg viewBox="0 0 24 24" {...s}><rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 11h16"/><circle cx="8" cy="20" r="1.5"/><circle cx="16" cy="20" r="1.5"/></svg>;
    case "passport":
      return <svg viewBox="0 0 24 24" {...s}><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="11" r="3"/><path d="M9 17h6"/></svg>;
    case "graduation":
      return <svg viewBox="0 0 24 24" {...s}><path d="M2 9l10-4 10 4-10 4z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/></svg>;
    case "briefcase":
      return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>;
    case "globe":
      return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    case "chev-right":
      return <svg viewBox="0 0 24 24" {...s}><path d="M9 6l6 6-6 6"/></svg>;
    case "chev-down":
      return <svg viewBox="0 0 24 24" {...s}><path d="M6 9l6 6 6-6"/></svg>;
    case "info":
      return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M12 11v5"/></svg>;
    case "refresh":
      return <svg viewBox="0 0 24 24" {...s}><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg>;
    case "mail":
      return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></svg>;
    case "shield":
      return <svg viewBox="0 0 24 24" {...s}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>;
    case "book":
      return <svg viewBox="0 0 24 24" {...s}><path d="M4 4a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0 0 4h13"/></svg>;
    case "user":
      return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case "plus":
      return <svg viewBox="0 0 24 24" {...s}><path d="M12 5v14M5 12h14"/></svg>;
    case "filter":
      return <svg viewBox="0 0 24 24" {...s}><path d="M3 5h18l-7 9v6l-4-2v-4z"/></svg>;
    case "up":
      return <svg viewBox="0 0 24 24" {...s}><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    default: return null;
  }
};

const BottomTabs = ({ active = "home" }) => (
  <div className="bottom-tabs">
    {[
      ["home", "홈", "home"],
      ["compare", "비교", "compare"],
      ["fav", "즐겨찾기", "star"],
      ["settings", "설정", "settings"],
    ].map(([id, label, icon]) => (
      <div key={id} className={"ti" + (active === id ? " active" : "")}>
        <div className="ic"><Icon name={icon} size={22} color={active === id ? "#FC6011" : "#8A98A0"} stroke={active === id ? 2.2 : 1.8} /></div>
        <span>{label}</span>
      </div>
    ))}
  </div>
);

// Bar pair for compare: SEO (light/secondary) vs CITY (orange)
const ComparePair = ({ label, icon, sValue, cValue, mult, sw, cw, hot = false }) => (
  <div className="card" style={{ padding: 12, borderRadius: 16 }}>
    <div className="row between" style={{ marginBottom: 8, gap: 8 }}>
      <div className="row gap-8" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: hot ? "#FFE9DC" : "#F0F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={icon} size={18} color={hot ? "#FC6011" : "#11263C"} stroke={2} />
        </div>
        <span className="h3" style={{ whiteSpace: "nowrap" }}>{label}</span>
      </div>
      <span style={{ fontWeight: 800, fontFamily: "Manrope", color: hot ? "#FC6011" : "#11263C", fontSize: 14, whiteSpace: "nowrap", flexShrink: 0 }}>{mult}</span>
    </div>
    <div className="col gap-6">
      <div className="row gap-8">
        <span className="tiny" style={{ width: 28, color: "#8A98A0", fontWeight: 700 }}>SEO</span>
        <div className="bar-track" style={{ flex: 1 }}>
          <div className="bar-fill gray" style={{ width: (sw * 100) + "%" }} />
        </div>
        <span style={{ width: 56, textAlign: "right", fontSize: 11, color: "#52616B", fontWeight: 600 }}>{sValue}</span>
      </div>
      <div className="row gap-8">
        <span className="tiny" style={{ width: 28, color: "#FC6011", fontWeight: 700 }}>VAN</span>
        <div className="bar-track" style={{ flex: 1 }}>
          <div className="bar-fill orange" style={{ width: (cw * 100) + "%" }} />
        </div>
        <span style={{ width: 56, textAlign: "right", fontSize: 11, color: "#11263C", fontWeight: 700 }}>{cValue}</span>
      </div>
    </div>
  </div>
);

Object.assign(window, { Phone, PhoneStage, Icon, BottomTabs, ComparePair, StatusIcons });
