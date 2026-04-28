// 온보딩 A — 큰 버튼 리스트 (PRD 그대로 · 모바일 표준)

window.OnboardingScreen = function () {
  return (
    <Phone>
      <div className="screen-body" style={{ padding: "8px 22px 0", justifyContent: "space-between" }}>
        <div className="col gap-12" style={{ marginTop: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(252,96,17,0.3)" }}>
            <Icon name="globe" size={28} color="#fff" stroke={2.2} />
          </div>
          <div className="col gap-4">
            <div className="h-display" style={{ fontSize: 30 }}>안녕하세요</div>
            <div className="h-display" style={{ fontSize: 30, color: "var(--orange)" }}>어디로 떠나시나요?</div>
          </div>
          <div className="small" style={{ fontSize: 14, lineHeight: 1.5, maxWidth: 240 }}>
            서울 기준으로 해외 도시의 생활비를<br/>
            본인 페르소나에 맞게 비교해 드려요.
          </div>
        </div>

        <div className="col gap-10" style={{ marginTop: 24 }}>
          <div className="label-mono" style={{ marginBottom: 4 }}>어떤 분이신가요?</div>

          <button className="card" style={{ padding: 16, textAlign: "left", border: "1.5px solid var(--orange)", background: "var(--orange-tint)", borderRadius: 18, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="graduation" size={22} color="#fff" stroke={2.2} />
            </div>
            <div className="col gap-4" style={{ flex: 1 }}>
              <div className="h3">유학생</div>
              <div className="tiny">학비 · 셰어 · 식비 중심</div>
            </div>
            <Icon name="chev-right" size={20} color="#FC6011" stroke={2.2} />
          </button>

          <button className="card" style={{ padding: 16, textAlign: "left", borderRadius: 18, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, background: "#fff" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="briefcase" size={22} color="#11263C" stroke={2} />
            </div>
            <div className="col gap-4" style={{ flex: 1 }}>
              <div className="h3">취업자</div>
              <div className="tiny">실수령 · 1인 원룸 · 의료</div>
            </div>
            <Icon name="chev-right" size={20} color="#8A98A0" stroke={2} />
          </button>

          <button className="card" style={{ padding: 14, textAlign: "left", borderRadius: 18, borderStyle: "dashed", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: "transparent" }}>
            <div className="col" style={{ flex: 1 }}>
              <div className="h3" style={{ color: "var(--gray)", fontSize: 13 }}>아직 모르겠어요</div>
              <div className="tiny">둘 다 보여드릴게요</div>
            </div>
            <Icon name="chev-right" size={18} color="#8A98A0" stroke={2} />
          </button>
        </div>

        <div className="col gap-8" style={{ marginTop: 20, marginBottom: 16 }}>
          <div className="tiny" style={{ textAlign: "center" }}>설정에서 언제든 변경할 수 있어요</div>
        </div>
      </div>
    </Phone>
  );
};

window.OnboardingTab = function () {
  return (
    <>
      <div className="screen-intro">
        <div className="kicker">01 · Onboarding</div>
        <h2>환영 + 페르소나 선택</h2>
        <p>설치 직후 1회. 결정 부담을 줄이기 위해 '아직 모름'은 약하게.</p>
      </div>
      <PhoneStage tag="iPhone · Light" anno={
        <>
          <div className="anno-title">디자인 노트</div>
          <ul>
            <li>주황은 1차 CTA(유학생) — 가장 큰 사용자군 추정에 시각적 가중</li>
            <li>아이콘 컨테이너 = 10~12pt 라운드, 가독성 ↑</li>
            <li>'아직 모름'은 점선·낮은 채도로 부담 ↓</li>
            <li>설치→홈까지 1탭으로 도달</li>
          </ul>
        </>
      }>
        <window.OnboardingScreen />
      </PhoneStage>
    </>
  );
};
