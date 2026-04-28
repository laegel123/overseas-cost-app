// 설정 D — 프로필 느낌

window.SettingsScreen = function () {
  return (
    <Phone>
      <div className="screen-body" style={{ padding: 0, gap: 0 }}>
        <div style={{ padding: "8px 20px 0" }}>
          <div className="row between" style={{ marginBottom: 18 }}>
            <span className="h1">설정</span>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: "var(--light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="more" size={18} color="#11263C" stroke={2.2} />
            </div>
          </div>

          <div className="card" style={{ padding: 18, borderRadius: 22, background: "linear-gradient(135deg, #11263C 0%, #1d3a55 100%)", color: "#fff", border: "none", boxShadow: "0 12px 32px rgba(17,38,60,0.18)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(252,96,17,0.15)" }} />
            <div className="row gap-12" style={{ alignItems: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(252,96,17,0.3)" }}>
                <Icon name="graduation" size={26} color="#fff" stroke={2.2} />
              </div>
              <div className="col gap-4" style={{ flex: 1 }}>
                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "Manrope" }}>유학생 모드</span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>서울에서 출발 · 학비 중심</span>
              </div>
              <button style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 10, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>변경</button>
            </div>
          </div>

          <div className="row gap-8" style={{ marginTop: 14 }}>
            {[
              ["3", "즐겨찾기"],
              ["7", "최근 본"],
              ["20", "도시 DB"],
            ].map(([n, l]) => (
              <div key={l} className="card" style={{ flex: 1, padding: 14, borderRadius: 16, alignItems: "center", textAlign: "center", display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "Manrope", color: "var(--orange)", lineHeight: 1 }}>{n}</span>
                <span className="tiny" style={{ fontSize: 11 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "16px 20px 0", overflowY: "auto", flex: 1 }}>
          <div className="card" style={{ padding: 0, borderRadius: 18, overflow: "hidden" }}>
            {[
              { ic: "refresh", iconColor: "#FC6011", bg: "#FFE9DC", label: "데이터 새로고침", right: "2026-04-01" },
              { ic: "book", iconColor: "#11263C", bg: "#F0F5F9", label: "데이터 출처 보기", right: "12개" },
              { ic: "mail", iconColor: "#11263C", bg: "#F0F5F9", label: "피드백 보내기" },
              { ic: "shield", iconColor: "#11263C", bg: "#F0F5F9", label: "개인정보 처리방침" },
              { ic: "info", iconColor: "#8A98A0", bg: "#F0F5F9", label: "앱 정보", right: "v1.0.0", dim: true },
            ].map((item, i, arr) => (
              <div key={item.label} className="row" style={{ padding: "14px 14px", gap: 12, borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={item.ic} size={18} color={item.iconColor} stroke={2} />
                </div>
                <span className="h3" style={{ fontSize: 13, flex: 1, color: item.dim ? "var(--gray-2)" : "var(--navy)" }}>{item.label}</span>
                {item.right && <span className="tiny" style={{ fontSize: 11 }}>{item.right}</span>}
                <Icon name="chev-right" size={16} color="#8A98A0" stroke={2} />
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", padding: "20px 0 16px" }}>
            <span className="tiny" style={{ fontSize: 10 }}>Made with ♥ in Seoul · 2026</span>
          </div>
        </div>
      </div>
      <BottomTabs active="settings" />
    </Phone>
  );
};

window.SettingsTab = function () {
  return (
    <>
      <div className="screen-intro">
        <div className="kicker">05 · Settings</div>
        <h2>프로필 느낌 — 내 모드 + 통계</h2>
        <p>로그인 없이도 '내 앱' 느낌. 페르소나 카드 + 사용 통계 + 메뉴 리스트.</p>
      </div>
      <PhoneStage tag="iPhone · Light" anno={
        <>
          <div className="anno-title">디자인 노트</div>
          <ul>
            <li>네이비 그라디언트 카드 = '나'의 정체성. 주황 아이콘 컨테이너로 액센트</li>
            <li>통계 3카드(즐겨찾기/최근/DB)는 주황 숫자로 일관성 유지</li>
            <li>'데이터 새로고침'은 주황 아이콘 → 가장 핵심 액션 강조</li>
            <li>리스트 셀은 단일 카드 그룹(iOS 스타일) + chevron</li>
          </ul>
        </>
      }>
        <window.SettingsScreen />
      </PhoneStage>
    </>
  );
};
