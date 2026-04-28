// 홈 A — 표준 스택 (즐겨찾기 가로 스크롤 + 최근 + 검색 + 권역)

const FlagBox = ({ label, color = '#FC6011' }) => (
  <div
    style={{
      width: 24,
      height: 18,
      borderRadius: 4,
      background: color + '20',
      color,
      fontSize: 10,
      fontWeight: 800,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Manrope',
    }}
  >
    {label}
  </div>
);

const FavCard = ({ name, country, mult, multColor, sub, accent }) => (
  <div
    className="card"
    style={{
      minWidth: 168,
      padding: 16,
      borderRadius: 20,
      background: accent ? 'var(--navy)' : '#fff',
      color: accent ? '#fff' : 'var(--navy)',
      border: accent ? 'none' : '1px solid var(--line)',
      flexShrink: 0,
    }}
  >
    <div className="row between" style={{ marginBottom: 10 }}>
      <div
        style={{
          width: 32,
          height: 24,
          borderRadius: 5,
          background: accent ? 'rgba(255,255,255,0.15)' : 'var(--light)',
          color: accent ? '#fff' : 'var(--navy)',
          fontSize: 11,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Manrope',
        }}
      >
        {country}
      </div>
      <Icon name="star" size={16} color={accent ? '#FC6011' : '#8A98A0'} stroke={2} />
    </div>
    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Manrope' }}>{name}</div>
    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{sub}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 12 }}>
      <span
        style={{
          fontSize: 24,
          fontWeight: 800,
          fontFamily: 'Manrope',
          color: multColor || (accent ? '#FC6011' : '#FC6011'),
          lineHeight: 1,
        }}
      >
        {mult}
      </span>
      <span style={{ fontSize: 11, opacity: 0.6 }}>vs 서울</span>
    </div>
  </div>
);

const RegionPill = ({ label, count, active }) => (
  <div className={'chip' + (active ? ' solid' : '')} style={{ padding: '8px 14px', fontSize: 12 }}>
    {label}
    <span style={{ marginLeft: 6, opacity: 0.6, fontWeight: 500 }}>{count}</span>
  </div>
);

window.HomeScreen = function () {
  return (
    <Phone>
      <div className="screen-body" style={{ padding: 0, gap: 0 }}>
        <div style={{ padding: '8px 20px 0' }}>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div className="col gap-4">
              <div className="tiny" style={{ fontSize: 12 }}>
                안녕하세요 👋
              </div>
              <div className="h1">어디 가시나요?</div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                background: 'var(--light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="user" size={20} color="#52616B" stroke={2} />
            </div>
          </div>

          <div
            className="row gap-8"
            style={{
              background: 'var(--light)',
              borderRadius: 14,
              padding: '12px 14px',
              marginBottom: 18,
            }}
          >
            <Icon name="search" size={18} color="#8A98A0" stroke={2} />
            <span style={{ color: 'var(--gray-2)', fontSize: 13, flex: 1 }}>
              도시 검색 · 한글/영어
            </span>
            <Icon name="filter" size={16} color="#52616B" stroke={2} />
          </div>
        </div>

        <div style={{ padding: '0 0 0 20px' }}>
          <div className="row between" style={{ paddingRight: 20, marginBottom: 10 }}>
            <div className="row gap-6" style={{ alignItems: 'center' }}>
              <Icon name="star" size={14} color="#FC6011" stroke={2.2} />
              <span className="h2" style={{ fontSize: 16 }}>
                즐겨찾기
              </span>
            </div>
            <span className="tiny">전체 보기</span>
          </div>
          <div
            className="row gap-10 hide-scroll"
            style={{ overflowX: 'auto', paddingBottom: 6, paddingRight: 20 }}
          >
            <FavCard name="밴쿠버" country="CA" sub="Vancouver" mult="↑1.9×" accent />
            <FavCard name="토론토" country="CA" sub="Toronto" mult="↑1.7×" />
            <FavCard name="베를린" country="DE" sub="Berlin" mult="↑1.2×" />
          </div>
        </div>

        <div style={{ padding: '0 20px', marginTop: 18 }}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <span className="h2" style={{ fontSize: 16 }}>
              최근 본 도시
            </span>
            <span className="tiny">5개</span>
          </div>
          <div className="col gap-8">
            {[
              ['뉴욕', 'New York', 'US', '↑2.4×', '#FC6011'],
              ['베를린', 'Berlin', 'DE', '↑1.2×', '#52616B'],
              ['시드니', 'Sydney', 'AU', '↑1.8×', '#FC6011'],
            ].map(([k, en, c, m, col]) => (
              <div
                key={k}
                className="card"
                style={{
                  padding: '10px 12px',
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--light)',
                    color: 'var(--navy)',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Manrope',
                  }}
                >
                  {c}
                </div>
                <div className="col" style={{ flex: 1, gap: 0 }}>
                  <span className="h3" style={{ fontSize: 14 }}>
                    {k}
                  </span>
                  <span className="tiny">{en}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: col, fontFamily: 'Manrope' }}>
                  {m}
                </span>
                <Icon name="chev-right" size={16} color="#8A98A0" stroke={2} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '0 20px', marginTop: 18, marginBottom: 16 }}>
          <span className="h2" style={{ fontSize: 16, display: 'block', marginBottom: 10 }}>
            권역별 탐색
          </span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            <RegionPill label="북미" count="8" active />
            <RegionPill label="유럽" count="5" />
            <RegionPill label="아시아" count="4" />
            <RegionPill label="오세아니아" count="2" />
            <RegionPill label="중동" count="1" />
          </div>
        </div>
      </div>
      <BottomTabs active="home" />
    </Phone>
  );
};

window.HomeTab = function () {
  return (
    <>
      <div className="screen-intro">
        <div className="kicker">02 · Home</div>
        <h2>표준 스택 — 즐겨찾기 우선</h2>
        <p>
          재방문 사용자가 가장 보고 싶은 카드(즐겨찾기)를 가로 스크롤로. 최근 + 검색 + 권역이
          자연스럽게 따라붙음.
        </p>
      </div>
      <PhoneStage
        tag="iPhone · Light"
        anno={
          <>
            <div className="anno-title">디자인 노트</div>
            <ul>
              <li>첫 카드는 네이비 풀필 — '대표 도시'로 시각적 무게</li>
              <li>배수는 모두 주황으로 표기, 단 '↓' (저렴) 케이스는 그레이로 약화</li>
              <li>국가코드는 mini 라벨로 처리 — 국기 PNG 의존도 ↓</li>
              <li>권역 칩 활성색은 네이비 풀, 비활성은 outlined</li>
            </ul>
          </>
        }
      >
        <window.HomeScreen />
      </PhoneStage>
    </>
  );
};
