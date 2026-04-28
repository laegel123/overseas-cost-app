// 항목 상세 A — 식비 섹션 리스트

const GroceryRow = ({ icon, name, seoul, city, mult, hot }) => (
  <div
    className="row"
    style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', gap: 12 }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: hot ? '#FFE9DC' : '#F0F5F9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div className="col" style={{ flex: 1, gap: 2 }}>
      <span className="h3" style={{ fontSize: 13 }}>
        {name}
      </span>
      <span className="tiny" style={{ fontSize: 11 }}>
        {seoul} → {city}
      </span>
    </div>
    <span
      style={{
        fontSize: 13,
        fontWeight: 800,
        fontFamily: 'Manrope',
        color: hot ? '#FC6011' : '#52616B',
      }}
    >
      {mult}
    </span>
  </div>
);

window.DetailScreen = function () {
  return (
    <Phone>
      <div className="screen-body" style={{ padding: 0, gap: 0 }}>
        <div style={{ padding: '8px 20px 12px' }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: 'var(--light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="back" size={18} color="#11263C" stroke={2.2} />
            </div>
            <div className="col" style={{ alignItems: 'center', gap: 0 }}>
              <span className="h3" style={{ fontSize: 14 }}>
                식비
              </span>
              <span className="tiny" style={{ fontSize: 10 }}>
                서울 vs 밴쿠버
              </span>
            </div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: 'var(--light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="more" size={18} color="#11263C" stroke={2.2} />
            </div>
          </div>

          <div
            className="card"
            style={{
              background: 'var(--navy)',
              color: '#fff',
              padding: 16,
              borderRadius: 20,
              border: 'none',
            }}
          >
            <div className="row between" style={{ marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  opacity: 0.7,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                월 예상 식비 (혼합)
              </span>
              <Icon name="info" size={14} color="#fff" stroke={2} />
            </div>
            <div className="row between" style={{ alignItems: 'baseline', gap: 4 }}>
              <div className="col gap-4" style={{ flexShrink: 0 }}>
                <span style={{ fontSize: 11, opacity: 0.6 }}>서울</span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: 'Manrope',
                    whiteSpace: 'nowrap',
                  }}
                >
                  45만
                </span>
              </div>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  fontFamily: 'Manrope',
                  color: '#FC6011',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                ↑1.4×
              </span>
              <div className="col" style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 11, opacity: 0.6 }}>밴쿠버</span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    fontFamily: 'Manrope',
                    whiteSpace: 'nowrap',
                  }}
                >
                  62만
                </span>
              </div>
            </div>
            <div
              style={{
                height: 4,
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 2,
                marginTop: 14,
                overflow: 'hidden',
              }}
            >
              <div
                style={{ width: '70%', height: '100%', background: '#FC6011', borderRadius: 2 }}
              />
            </div>
            <div
              className="tiny"
              style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8, fontSize: 10 }}
            >
              자취 70% + 외식 30% 가정
            </div>
          </div>
        </div>

        <div style={{ padding: '0 20px', overflowY: 'auto', flex: 1 }}>
          <div className="row between" style={{ marginBottom: 6, marginTop: 4 }}>
            <span className="label-mono">외식</span>
            <span className="tiny" style={{ fontSize: 10 }}>
              2 항목
            </span>
          </div>
          <div className="card" style={{ padding: '2px 14px', borderRadius: 16 }}>
            <GroceryRow icon="🍱" name="식당 한 끼" seoul="1.2만" city="2.2만" mult="↑1.8×" hot />
            <div style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <GroceryRow icon="☕" name="카페 라떼" seoul="5천" city="7.4천" mult="↑1.5×" />
            </div>
          </div>

          <div className="row between" style={{ marginBottom: 6, marginTop: 16 }}>
            <span className="label-mono">식재료</span>
            <span className="tiny" style={{ fontSize: 10 }}>
              8 항목
            </span>
          </div>
          <div className="card" style={{ padding: '2px 14px', borderRadius: 16 }}>
            <GroceryRow icon="🍜" name="신라면 (1봉)" seoul="1천" city="2.4천" mult="↑2.5×" hot />
            <GroceryRow icon="🥚" name="계란 12구" seoul="4.5천" city="7.4천" mult="↑1.6×" />
            <GroceryRow icon="🍚" name="쌀 1kg" seoul="3.2천" city="4.1천" mult="↑1.3×" />
            <GroceryRow icon="🥩" name="닭가슴살 1kg" seoul="1.4만" city="1.7만" mult="↑1.2×" />
            <GroceryRow icon="🥛" name="우유 1L" seoul="3천" city="3.3천" mult="↑1.1×" />
            <GroceryRow icon="🍞" name="식빵 1봉" seoul="3.5천" city="4.5천" mult="↑1.3×" />
            <GroceryRow icon="🍎" name="사과 1개" seoul="1.5천" city="1.8천" mult="↑1.2×" />
          </div>

          <div className="row between" style={{ padding: '16px 4px 18px' }}>
            <div className="col gap-4">
              <span className="tiny" style={{ fontSize: 10 }}>
                출처
              </span>
              <span style={{ fontSize: 11, color: 'var(--navy)', fontWeight: 600 }}>
                Statistics Canada
              </span>
            </div>
            <span
              className="tiny"
              style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 700 }}
            >
              출처 보기 →
            </span>
          </div>
        </div>
      </div>
    </Phone>
  );
};

window.DetailTab = function () {
  return (
    <>
      <div className="screen-intro">
        <div className="kicker">04 · Detail (식비)</div>
        <h2>섹션 리스트 — 외식 + 식재료</h2>
        <p>상단 네이비 카드 = 카테고리 합. 아래로 외식·식재료 섹션이 분리. 한 줄 = 한 품목.</p>
      </div>
      <PhoneStage
        tag="iPhone · Light"
        anno={
          <>
            <div className="anno-title">디자인 노트</div>
            <ul>
              <li>네이비 헤더 카드: 비교 메인과 위계 구분(주황은 메인, 네이비는 카테고리 합)</li>
              <li>품목 아이콘은 이모지 — 인지 부하 ↓, 한국인 친숙도 ↑</li>
              <li>↑2× 이상 항목은 주황 hot — '신라면 2.5배'가 즉시 점프</li>
              <li>섹션 라벨에 항목 수(2/8) 노출 — 콘텐츠 양 가늠</li>
            </ul>
          </>
        }
      >
        <window.DetailScreen />
      </PhoneStage>
    </>
  );
};
