// 비교 A — 듀얼 바 (PRD 표준)

window.CompareScreen = function () {
  return (
    <Phone>
      <div className="screen-body" style={{ padding: 0, gap: 12 }}>
        <div style={{ padding: '8px 20px 0' }}>
          <div className="row between" style={{ marginBottom: 16 }}>
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
            <div className="col" style={{ alignItems: 'center', gap: 0, flex: 1, minWidth: 0 }}>
              <div className="h3" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
                서울 vs 밴쿠버
              </div>
              <div className="tiny" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                1 CAD = 980원 · 04-27
              </div>
            </div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: 'var(--orange-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="star" size={18} color="#FC6011" stroke={2.2} />
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px' }}>
          <div
            className="card orange"
            style={{
              padding: 18,
              borderRadius: 22,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 12px 32px rgba(252,96,17,0.25)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: -30,
                top: -30,
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
              }}
            />
            <div className="row between" style={{ marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  opacity: 0.85,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                한 달 예상 총비용
              </span>
              <Icon name="info" size={14} color="#fff" stroke={2} />
            </div>
            <div
              className="row between"
              style={{ alignItems: 'flex-end', marginBottom: 12, gap: 4 }}
            >
              <div className="col gap-4" style={{ flexShrink: 0 }}>
                <span style={{ fontSize: 11, opacity: 0.7 }}>서울</span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: 'Manrope',
                    whiteSpace: 'nowrap',
                  }}
                >
                  175만
                </span>
              </div>
              <div className="col" style={{ alignItems: 'center', gap: 0, flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    fontFamily: 'Manrope',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  ↑1.9×
                </span>
                <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2, whiteSpace: 'nowrap' }}>
                  +165만/월
                </span>
              </div>
              <div className="col" style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 11, opacity: 0.7 }}>밴쿠버</span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    fontFamily: 'Manrope',
                    whiteSpace: 'nowrap',
                  }}
                >
                  340만
                </span>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 4,
                height: 6,
                borderRadius: 3,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.2)',
              }}
            >
              <div style={{ width: '50%', background: 'rgba(255,255,255,0.5)' }} />
              <div style={{ width: '45%', background: '#fff' }} />
            </div>
            <div
              className="tiny"
              style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8, fontSize: 10 }}
            >
              평균 가정 기준 · ❓ 자세히
            </div>
          </div>
        </div>

        <div className="col gap-8" style={{ padding: '0 16px', overflowY: 'auto', flex: 1 }}>
          <ComparePair
            label="월세"
            icon="house"
            sValue="60만"
            cValue="135만"
            mult="↑2.3×"
            sw={0.4}
            cw={0.85}
            hot
          />
          <ComparePair
            label="식비"
            icon="fork"
            sValue="45만"
            cValue="62만"
            mult="↑1.4×"
            sw={0.55}
            cw={0.75}
          />
          <ComparePair
            label="교통"
            icon="bus"
            sValue="6만"
            cValue="9만"
            mult="↑1.5×"
            sw={0.4}
            cw={0.6}
          />
          <ComparePair
            label="비자/정착"
            icon="passport"
            sValue="—"
            cValue="115만"
            mult="신규"
            sw={0.0}
            cw={0.5}
            hot
          />

          <div
            className="row between"
            style={{ padding: '12px 4px 18px', borderTop: '1px dashed var(--line)', marginTop: 4 }}
          >
            <span className="tiny">출처 12개 · 갱신 2026-04-01</span>
            <span className="tiny" style={{ color: 'var(--orange)', fontWeight: 700 }}>
              출처 보기 →
            </span>
          </div>
        </div>
      </div>
      <BottomTabs active="compare" />
    </Phone>
  );
};

window.CompareTab = function () {
  return (
    <>
      <div className="screen-intro">
        <div className="kicker">03 · Compare (메인)</div>
        <h2>듀얼 바 — 서울 vs 도시</h2>
        <p>
          앱의 심장. 상단 주황 카드에서 한눈에 배수, 아래로 내려가며 카테고리별 SEO/CITY 길이 비교.
        </p>
      </div>
      <PhoneStage
        tag="iPhone · Light"
        anno={
          <>
            <div className="anno-title">디자인 노트</div>
            <ul>
              <li>주황 풀필 카드 = 가장 임팩트 큰 숫자(↑1.9×)에 시각적 weight 집중</li>
              <li>SEO 바는 그레이, VAN 바는 주황 — 색만으로 즉시 구별, 라벨도 동시 제공(접근성)</li>
              <li>'비싼 항목'(↑2× 이상)은 카테고리 아이콘 배경이 주황으로 hot 표시</li>
              <li>비자처럼 '서울에 없는' 항목은 '신규'로 표기 — 배수 X</li>
            </ul>
          </>
        }
      >
        <window.CompareScreen />
      </PhoneStage>
    </>
  );
};
