import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '../components/ui/Icon';
import { DateFilter } from '../components/ui/DateFilter';
import { fetchDashboardData, updateCell, sendAlimtalk, type ExchangeData } from '../api/sheets';

// ── 경과일 구간 ──────────────────────────────────────────────────
const DAY_BUCKETS = [
  { label: '전체', key: 'all', min: 0, max: Infinity, activeColor: 'bg-slate-700 text-white shadow-md', defaultColor: 'bg-slate-100 text-slate-600' },
  { label: '3일', key: '3d', min: 3, max: 4, activeColor: 'bg-amber-500 text-white shadow-amber-100 shadow-md', defaultColor: 'bg-amber-50 text-amber-700' },
  { label: '5일', key: '5d', min: 5, max: 6, activeColor: 'bg-orange-500 text-white shadow-orange-100 shadow-md', defaultColor: 'bg-orange-50 text-orange-700' },
  { label: '7일', key: '7d', min: 7, max: 7, activeColor: 'bg-rose-500 text-white shadow-rose-100 shadow-md', defaultColor: 'bg-rose-50 text-rose-700' },
  { label: '7일+', key: '7d+', min: 8, max: Infinity, activeColor: 'bg-red-700 text-white shadow-red-100 shadow-md', defaultColor: 'bg-red-50 text-red-800' },
] as const;
type DayBucketKey = typeof DAY_BUCKETS[number]['key'];

const isIpgo = (shipVal: string): boolean =>
  typeof shipVal === 'string' && shipVal.startsWith('입고');

type ReasonKey = '옵션 누락' | '미입금' | '장기 미회수';
const detectReasons = (row: any, diffDays: number, shipVal: string): ReasonKey[] => {
  const reasons: ReasonKey[] = [];
  const option = (row['교환 출고 옵션'] || '').trim();
  const pay = (row['지불방법'] || '').trim();
  if (!option || option === '확인중') reasons.push('옵션 누락');
  if (pay === '입금요청' || pay === '미입금') reasons.push('미입금');
  if (reasons.length === 0 && diffDays >= 7 && shipVal === '') {
    reasons.push('장기 미회수');
  }
  return reasons;
};

const REASON_FILTERS: { label: string; key: ReasonKey | 'all' | '입고됨' | '입고안됨' | '미발송' }[] = [
  { label: '전체', key: 'all' },
  { label: '📦 입고됨', key: '입고됨' },
  { label: '📭 입고안됨', key: '입고안됨' },
  { label: '📨 알림톡 미발송', key: '미발송' },
  { label: '옵션 누락', key: '옵션 누락' },
  { label: '미입금', key: '미입금' },
  { label: '장기 미회수', key: '장기 미회수' },
];

const getDayBadgeStyle = (days: number) => {
  if (days >= 8) return 'bg-red-100 text-red-800 border border-red-200';
  if (days >= 7) return 'bg-rose-100 text-rose-700 border border-rose-200';
  if (days >= 5) return 'bg-orange-100 text-orange-700 border border-orange-200';
  return 'bg-amber-100 text-amber-700 border border-amber-200';
};

const REASON_BADGE: Record<string, string> = {
  '옵션 누락': 'bg-amber-100 text-amber-700',
  '미입금': 'bg-red-100 text-red-700',
  '기타': 'bg-slate-50 text-slate-400',
};

const parseIpgoDate = (val: string): string => {
  const m = val.match(/(\d{2})(\d{2})/);
  if (!m) return val;
  return `${parseInt(m[1])}/${parseInt(m[2])} 입고`;
};

// ── 인라인 편집 셀 컴포넌트 ──────────────────────────────────────
interface EditableCellProps {
  value: string;
  rowIndex: number;
  column: string;
  sheetTitle: string;
  onSaved: (rowIndex: number, column: string, newValue: string) => void;
}
const EditableCell: React.FC<EditableCellProps> = ({ value, rowIndex, column, sheetTitle, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [inputType, setInputType] = useState<'text' | 'date'>('text');

  const handleSave = async () => {
    if (draft === (value || '')) { setEditing(false); return; }
    
    // 디버깅: 전송 데이터 확인
    console.log('Attempting save:', { sheetTitle, rowIndex, column, value: draft });
    
    if (rowIndex === undefined || rowIndex === null) {
      setError('행 번호(rowIndex)가 없습니다.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await updateCell({ sheetTitle, rowIndex, column, value: draft });
      onSaved(rowIndex, column, draft);
      setEditing(false);
    } catch (e: any) {
      console.error('Save failed:', e);
      setError(e.message || '저장 오류');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[120px]">
        <input
          autoFocus
          type={inputType}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border border-indigo-300 rounded-lg px-2 py-1 text-xs w-full focus:outline-none focus:ring-2 focus:ring-indigo-300 h-8"
        />
        {column === '출고일' && (
          <button
            onClick={() => {
              const newType = inputType === 'text' ? 'date' : 'text';
              setInputType(newType);
              // 날짜로 바꿀 때 기존 값이 날짜 형식이 아니면 비워줌 (입력 편의성)
              if (newType === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(draft)) {
                setDraft(new Date().toISOString().split('T')[0]);
              }
            }}
            className={`p-1 rounded-lg transition-colors ${inputType === 'date' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            title={inputType === 'date' ? '텍스트 입력으로 전환' : '날짜 선택으로 전환'}
          >
            <Icon name="calendar_today" className="text-xs" />
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="p-1 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
          title="저장 (Enter)"
        >
          {saving
            ? <Icon name="sync" className="text-xs animate-spin" />
            : <Icon name="check" className="text-xs" />}
        </button>
        <button
          onClick={() => { setDraft(value || ''); setEditing(false); setInputType('text'); }}
          className="p-1 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
          title="취소 (Esc)"
        >
          <Icon name="close" className="text-xs" />
        </button>
        {error && <span className="text-[10px] text-red-500 whitespace-nowrap">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(value || ''); setEditing(true); }}
      className="group flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors text-left w-full"
      title="클릭하여 편집"
    >
      <span className={`text-xs ${value ? 'text-slate-700' : 'text-slate-300 italic'}`}>
        {value || '미기재'}
      </span>
      <Icon name="edit" className="text-[11px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════
export const StuckCases: React.FC = () => {
  const [data, setData] = useState<ExchangeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dayFilter, setDayFilter] = useState<DayBucketKey>('all');
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // 로컬 반영용 덮어쓰기 맵: key = `${rowIndex}__${column}`, value = 새 값
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({});
  // 발송 중 여부: key = rowIndex
  const [sendingRows, setSendingRows] = useState<Record<number, boolean>>({});
  // 발송 실패 여부: key = rowIndex
  const [failedRows, setFailedRows] = useState<Record<number, boolean>>({});

  // localStorage에서 주문번호별 발송 이력을 가져옴
  const getAlimtalkHistory = (orderNumber: string): string[] => {
    try {
      const raw = localStorage.getItem(`alimtalk_history_${orderNumber}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  // 발송 시 이력 추가
  const addAlimtalkHistory = (orderNumber: string, timestamp: string) => {
    try {
      const existing = getAlimtalkHistory(orderNumber);
      const updated = [...existing, timestamp];
      localStorage.setItem(`alimtalk_history_${orderNumber}`, JSON.stringify(updated));
    } catch {}
  };

  // 발송 이력 새로고침용 상태 (강제 리렌더)
  const [historyTick, setHistoryTick] = useState(0);

  const [isSendingAll, setIsSendingAll] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const getAllHistory = () => {
    const all: any[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('alimtalk_history_')) {
          const orderNum = key.replace('alimtalk_history_', '');
          const history = JSON.parse(localStorage.getItem(key) || '[]');
          if (history.length > 0) {
            all.push({ orderNumber: orderNum, history });
          }
        }
      }
      return all.sort((a, b) => {
        const aLast = a.history[a.history.length - 1] || '';
        const bLast = b.history[b.history.length - 1] || '';
        return bLast.localeCompare(aLast);
      });
    } catch { return []; }
  };

  const handleSendAlimtalk = async (row: any) => {
    const rowIndex = row['__rowIndex'];
    const orderNumber = row['주문번호'];
    setSendingRows(prev => ({ ...prev, [rowIndex]: true }));
    setFailedRows(prev => ({ ...prev, [rowIndex]: false }));
    try {
      await sendAlimtalk({ rowIndex, row, sheetTitle: '[자사몰] 교환' });
      const ts = new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      addAlimtalkHistory(orderNumber, ts);
      setHistoryTick(t => t + 1);
    } catch (e: any) {
      setFailedRows(prev => ({ ...prev, [rowIndex]: true }));
    } finally {
      setSendingRows(prev => ({ ...prev, [rowIndex]: false }));
    }
  };

  const handleSendAllAlimtalk = async () => {
    // 중복을 제외한 실제 발송 대상 고유 키 추출 (주문번호 + 접수일 + 사유 조합)
    const uniqueKeysToSend = new Set<string>();
    const uniqueRowsToSend: any[] = [];

    for (const row of stuckCases) {
      const isOnlyGeneral = row.reasons.length === 1 && row.reasons[0] === '기타';
      if (!isOnlyGeneral) {
        const orderNumber = row['주문번호'];
        const registryDate = row['접수일'];
        const sortedReasons = [...row.reasons].sort().join('|');
        const uniqueKey = `${orderNumber}_${registryDate}_${sortedReasons}`;
        
        if (!uniqueKeysToSend.has(uniqueKey)) {
          uniqueKeysToSend.add(uniqueKey);
          uniqueRowsToSend.push(row);
        }
      }
    }

    if (uniqueRowsToSend.length === 0) {
      alert("발송할 대상이 없습니다.");
      return;
    }

    if (!window.confirm(`중복 건을 제외한 총 ${uniqueRowsToSend.length}건의 알림톡을 발송하시겠습니까?`)) return;
    
    setIsSendingAll(true);
    let sentCount = 0;
    for (const row of uniqueRowsToSend) {
      await handleSendAlimtalk(row);
      sentCount++;
    }
    setIsSendingAll(false);
    alert(`${sentCount}건 발송 처리가 구동되었습니다.`);
  };

  const handleReasonClick = (key: string) => {
    if (key === 'all') {
      setSelectedReasons([]);
      return;
    }
    setSelectedReasons(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchDashboardData();
      setData(result);
      // 동기화 시 로컬 편집 내역을 초기화하여 구글시트의 최신 상태를 강제 반영
      setLocalOverrides({});
      
      if (!startDate || !endDate) {
        const rows = result.data.jasaMall || [];
        const dates = rows.map((r: any) => r['접수일']?.replace(/\./g, '-')).filter(Boolean).sort();
        if (dates.length > 0) {
          const maxDateStr = dates[dates.length - 1];
          const maxDate = new Date(maxDateStr);
          const start = new Date(maxDate);
          start.setMonth(start.getMonth() - 1);
          setEndDate(maxDateStr);
          setStartDate(start.toISOString().split('T')[0]);
        }
      }
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // 저장 성공 시 로컬 상태에도 반영 (새로고침 없이 즉시 보임)
  const handleCellSaved = (rowIndex: number, column: string, newValue: string) => {
    setLocalOverrides(prev => ({ ...prev, [`${rowIndex}__${column}`]: newValue }));
  };

  // 로컬 덮어쓰기 적용 헬퍼
  const getCellValue = (row: any, column: string): string => {
    const key = `${row['__rowIndex']}__${column}`;
    return key in localOverrides ? localOverrides[key] : (row[column] || '');
  };

  const now = new Date();

  const allStuck = useMemo(() => {
    if (!data?.data.jasaMall) return [];

    return (data.data.jasaMall as any[]).filter(row => {
      const registryDateStr = (row['접수일'] || '').replace(/\./g, '-');
      if (!registryDateStr) return false;
      if (startDate && registryDateStr < startDate) return false;
      if (endDate && registryDateStr > endDate) return false;

      // 로컬 편집 내용이 있으면 해당 값을 우선 사용
      const shipVal = getCellValue(row, '출고일').trim();
      const exchangeType = getCellValue(row, '교환형태').trim();

      // 일반 출고(날짜 형식)는 제외 — 입고MMDD 또는 비어있거나 특수상태만 포함
      const isNormalShip = /^\d{4}-\d{2}-\d{2}$/.test(shipVal) || /^\d{4}\.\d{2}\.\d{2}$/.test(shipVal);
      if (isNormalShip) return false;

      // 철회/교환불가는 제외 (출고일 컬럼 또는 교환형태 컬럼 기준)
      if (shipVal === '철회' || shipVal === '교환불가' || exchangeType === '철회') return false;

      const registryDate = new Date(registryDateStr);
      if (isNaN(registryDate.getTime())) return false;

      const diffDays = (now.getTime() - registryDate.getTime()) / (1000 * 3600 * 24);
      
      const option = (row['교환 출고 옵션'] || '').trim();
      const pay = (row['지불방법'] || '').trim();
      const hasMissingOption = !option || option === '확인중';
      const hasUnpaid = pay === '입금요청' || pay === '미입금';
      
      if (hasMissingOption || hasUnpaid) {
        return diffDays >= 3;
      } else {
        // 미입금, 옵션 누락이 아닌 건은 7일 이상 경과 && 출고일이 완전히 비어있을 때만 노출
        return diffDays >= 7 && shipVal === '';
      }
    }).map((row: any) => {
      const registryDateStr = (row['접수일'] || '').replace(/\./g, '-');
      const registryDate = new Date(registryDateStr);
      const diffDays = Math.floor((now.getTime() - registryDate.getTime()) / (1000 * 3600 * 24));
      
      // 최신 편집값 반영
      const shipVal = getCellValue(row, '출고일').trim();
      const arrived = isIpgo(shipVal);
      
      // 사유 판별 시에도 최신 편집값(옵션, 지불방법 등) 반영
      const reasons = detectReasons({
        ...row,
        '지불방법': getCellValue(row, '지불방법'),
        '교환 출고 옵션': getCellValue(row, '교환 출고 옵션')
      }, diffDays, shipVal);
      const ipgoDateLabel = arrived ? parseIpgoDate(shipVal) : null;
      const history = getAlimtalkHistory(row['주문번호']);
      const hasHistory = history.length > 0;
      return { ...row, daysPassed: diffDays, reasons, arrived, ipgoDateLabel, hasHistory };
    }).sort((a: any, b: any) => b.daysPassed - a.daysPassed);
  }, [data, startDate, endDate, localOverrides, historyTick]);

  const bucketCounts = useMemo(() => {
    const c: Record<string, number> = { all: allStuck.length };
    DAY_BUCKETS.slice(1).forEach(b => {
      c[b.key] = allStuck.filter((r: any) => r.daysPassed >= b.min && r.daysPassed <= b.max).length;
    });
    return c;
  }, [allStuck]);

  const reasonCounts = useMemo(() => {
    const c: Record<string, number> = { all: allStuck.length };
    REASON_FILTERS.slice(1).forEach(f => {
      if (f.key === '입고됨') c['입고됨'] = allStuck.filter((r: any) => r.arrived).length;
      else if (f.key === '입고안됨') c['입고안됨'] = allStuck.filter((r: any) => !r.arrived).length;
      else if (f.key === '미발송') c['미발송'] = allStuck.filter((r: any) => !r.hasHistory).length;
      else if (f.key !== 'all') c[f.key] = allStuck.filter((r: any) => r.reasons.includes(f.key)).length;
    });
    return c;
  }, [allStuck]);

  const stuckCases = useMemo(() => {
    let rows = allStuck as any[];
    if (dayFilter !== 'all') {
      const b = DAY_BUCKETS.find(b => b.key === dayFilter)!;
      rows = rows.filter(r => r.daysPassed >= b.min && r.daysPassed <= b.max);
    }
    if (selectedReasons.length > 0) {
      // 1. 입고 여부 (독립된 배타 축) — '입고됨'/'입고안됨' 중 하나만 켜진 경우에만 적용
      const wantArrived = selectedReasons.includes('입고됨');
      const wantNotArrived = selectedReasons.includes('입고안됨');
      if (wantArrived && !wantNotArrived) {
        rows = rows.filter(r => r.arrived);
      } else if (wantNotArrived && !wantArrived) {
        rows = rows.filter(r => !r.arrived);
      }
      // 둘 다 켜졌거나 둘 다 꺼진 경우 입고 필터는 적용하지 않음 (= 전체)

      // 2. 알림톡 미발송 필터 적용
      if (selectedReasons.includes('미발송')) {
        rows = rows.filter(r => !r.hasHistory);
      }

      const otherReasons = selectedReasons.filter(k => k !== '입고됨' && k !== '입고안됨' && k !== '미발송');
      if (otherReasons.length > 0) {
        // 정확히 일치하는 사유 집합만 필터링 (Exact Match)
        rows = rows.filter(r =>
          r.reasons.length === otherReasons.length &&
          otherReasons.every(req => r.reasons.includes(req))
        );
      }
    }
    // 아무 필터도 선택되지 않은 '전체' 상태에서는 입고/미입고 모두 노출
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(r =>
        (r['주문번호'] || '').toLowerCase().includes(q) ||
        (r['상품명'] || '').toLowerCase().includes(q) ||
        (r['수령자'] || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [allStuck, dayFilter, selectedReasons, searchQuery]);

  if (loading && !data) return (
    <div className="flex h-[80vh] items-center justify-center text-indigo-600 font-black animate-pulse">지연 사례 분석 중...</div>
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto w-full pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">교환 미처리 관리</h2>
          <p className="text-sm text-slate-400 font-bold mt-1 uppercase tracking-widest opacity-70">자사몰 일반교환 · Pending Management</p>
        </div>
        <button onClick={loadData} className="p-2 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
          <Icon name="sync" className={loading ? 'animate-spin text-rose-500' : 'text-slate-400'} />
        </button>
      </div>

      <DateFilter startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {DAY_BUCKETS.slice(1).map(bucket => (
          <button key={bucket.key}
            onClick={() => setDayFilter(dayFilter === bucket.key ? 'all' : bucket.key)}
            className={`rounded-2xl p-5 text-left transition-all duration-200 border-2 ${dayFilter === bucket.key ? bucket.activeColor + ' border-transparent scale-[1.03]' : bucket.defaultColor + ' border-transparent hover:scale-[1.01] hover:shadow-md'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{bucket.label} 경과</p>
            <p className="text-3xl font-black">{bucketCounts[bucket.key]}<span className="text-xs opacity-40 ml-1">건</span></p>
          </button>
        ))}
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Icon name="schedule" className="text-rose-400 text-base" />
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">경과일</span>
          </div>
          {DAY_BUCKETS.map(bucket => (
            <button key={bucket.key} onClick={() => setDayFilter(bucket.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 ${dayFilter === bucket.key ? bucket.activeColor : bucket.defaultColor + ' hover:brightness-95'}`}>
              {bucket.label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${dayFilter === bucket.key ? 'bg-white/20' : 'bg-black/10'}`}>
                {bucketCounts[bucket.key] ?? allStuck.length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Icon name="label" className="text-indigo-400 text-base" />
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">사유 유형</span>
          </div>
          {REASON_FILTERS.map(f => {
            const isActive = f.key === 'all' 
              ? selectedReasons.length === 0 
              : selectedReasons.includes(f.key);
            
            return (
              <button key={f.key}
                onClick={() => handleReasonClick(f.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all duration-200
                  ${isActive
                    ? (f.key === '입고됨' ? 'bg-emerald-600 text-white shadow-emerald-100 shadow-md'
                      : f.key === '입고안됨' ? 'bg-sky-600 text-white shadow-sky-100 shadow-md'
                      : 'bg-indigo-600 text-white shadow-indigo-100 shadow-md')
                    : (f.key === '입고됨' ? 'bg-emerald-50 text-emerald-700 hover:brightness-95'
                      : f.key === '입고안됨' ? 'bg-sky-50 text-sky-700 hover:brightness-95'
                      : 'bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600')}`}>
                {f.label}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-black/10'}`}>
                  {reasonCounts[f.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-base pointer-events-none" />
        <input type="text" placeholder="주문번호 / 상품명 / 수령자 검색..."
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-100 shadow-sm rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all" />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
            <Icon name="close" className="text-base" />
          </button>
        )}
      </div>

      {/* 편집 안내 */}
      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
        <Icon name="edit" className="text-sm text-indigo-400" />
        <span>출고일 · 지불방법 셀을 <strong>클릭</strong>하면 직접 수정할 수 있습니다. 저장 시 구글시트에 즉시 반영됩니다.</span>
      </div>

      {/* ── 테이블 ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <div>
            <h4 className="font-black text-lg text-slate-900">지연 리스트</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {dayFilter !== 'all' ? `경과일 · ${DAY_BUCKETS.find(b => b.key === dayFilter)?.label}` : '전체 경과일'}
              {selectedReasons.length > 0 ? ` · 사유: ${selectedReasons.map(k => REASON_FILTERS.find(f => f.key === k)?.label).join(' + ')}` : ''}
              {searchQuery ? ` · 검색: "${searchQuery}"` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-black transition-colors"
            >
              <Icon name="history" className="text-sm" /> 전체 이력
            </button>
            <button
              onClick={handleSendAllAlimtalk}
              disabled={isSendingAll || stuckCases.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black shadow-sm transition-colors ${isSendingAll ? 'bg-yellow-200 text-yellow-600 cursor-not-allowed' : 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900'}`}
            >
              <Icon name={isSendingAll ? 'hourglass_empty' : 'send'} className={`text-sm ${isSendingAll ? 'animate-spin' : ''}`} />
              {isSendingAll ? '전체 발송 중...' : '조건 전체 발송'}
            </button>
            <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full ml-1">{stuckCases.length}건</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-4 text-[11px] font-black text-slate-400 uppercase whitespace-nowrap">경과일</th>
                <th className="p-4 text-[11px] font-black text-slate-400 uppercase whitespace-nowrap">접수일</th>
                <th className="p-4 text-[11px] font-black text-slate-400 uppercase whitespace-nowrap">주문번호</th>
                <th className="p-4 text-[11px] font-black text-slate-400 uppercase">상품명</th>
                <th className="p-4 text-[11px] font-black text-slate-400 uppercase whitespace-nowrap">교환 전 옵션</th>
                <th className="p-4 text-[11px] font-black text-slate-400 uppercase whitespace-nowrap">
                  <span className="flex items-center gap-1">교환 후 옵션 <Icon name="edit" className="text-[10px] text-indigo-300" /></span>
                </th>
                <th className="p-4 text-[11px] font-black text-slate-400 uppercase whitespace-nowrap">
                  <span className="flex items-center gap-1">출고일 <Icon name="edit" className="text-[10px] text-indigo-300" /></span>
                </th>
                <th className="p-4 text-[11px] font-black text-slate-400 uppercase whitespace-nowrap">
                  <span className="flex items-center gap-1">지불방법 <Icon name="edit" className="text-[10px] text-indigo-300" /></span>
                </th>
                <th className="p-4 text-center text-[11px] font-black text-slate-400 uppercase whitespace-nowrap">입고시 확인사항</th>
                <th className="p-4 text-center text-[11px] font-black text-slate-400 uppercase whitespace-nowrap">사유</th>
                <th className="p-4 text-center text-[11px] font-black text-slate-400 uppercase whitespace-nowrap">알림톡</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stuckCases.map((row: any, i: number) => {
                const currentShipVal = getCellValue(row, '출고일');
                const arrived = isIpgo(currentShipVal);
                return (
                  <tr key={i} className={`transition-colors hover:bg-slate-50/60 ${arrived ? 'bg-emerald-50/30' : ''}`}>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black ${getDayBadgeStyle(row.daysPassed)}`}>
                        {row.daysPassed}일
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500 font-mono whitespace-nowrap">{row['접수일']}</td>
                    <td className="p-4 text-xs font-mono font-bold text-indigo-600 whitespace-nowrap">{row['주문번호']}</td>
                    <td className="p-4 text-sm text-slate-700 min-w-[160px]">
                      <p className="font-semibold line-clamp-2">{row['상품명']}</p>
                      {row['수령자'] && <p className="text-[10px] text-slate-400 mt-0.5">{row['수령자']}</p>}
                    </td>
                    <td className="p-4 text-xs text-slate-500 whitespace-nowrap">{row['교환 전 옵션'] || '-'}</td>
                    {/* ✏️ 편집 가능: 교환 후 옵션 */}
                    <td className="p-2 min-w-[130px]">
                      <EditableCell
                        value={getCellValue(row, '교환 출고 옵션')}
                        rowIndex={row['__rowIndex']}
                        column="교환 출고 옵션"
                        sheetTitle="[자사몰] 교환"
                        onSaved={handleCellSaved}
                      />
                    </td>

                    {/* ✏️ 편집 가능: 출고일 */}
                    <td className="p-2 min-w-[130px]">
                      {arrived && (
                        <span className="block text-[10px] font-black text-emerald-600 mb-1 px-2">
                          📦 {parseIpgoDate(currentShipVal)}
                        </span>
                      )}
                      <EditableCell
                        value={currentShipVal}
                        rowIndex={row['__rowIndex']}
                        column="출고일"
                        sheetTitle="[자사몰] 교환"
                        onSaved={handleCellSaved}
                      />
                    </td>

                    {/* ✏️ 편집 가능: 지불방법 */}
                    <td className="p-2 min-w-[110px]">
                      <EditableCell
                        value={getCellValue(row, '지불방법')}
                        rowIndex={row['__rowIndex']}
                        column="지불방법"
                        sheetTitle="[자사몰] 교환"
                        onSaved={handleCellSaved}
                      />
                    </td>

                    <td className="p-4 text-center max-w-[180px]">
                      {row['입고시확인해야하는 것']
                        ? <span className="text-[10px] text-orange-700 bg-orange-50 px-2 py-1 rounded-lg line-clamp-2 text-left block">
                            {row['입고시확인해야하는 것']}
                          </span>
                        : <span className="text-slate-200 text-xs">—</span>
                      }
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex flex-wrap justify-center gap-1 min-w-[80px]">
                        {row.reasons.map((r: string, idx: number) => (
                          <span key={idx} className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap ${REASON_BADGE[r] || 'bg-slate-50 text-slate-400'}`}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* 📨 알림톡 발송 버튼 + 이력 */}
                    <td className="p-3 text-center min-w-[110px]">
                      {(() => {
                        const rowIndex = row['__rowIndex'];
                        const orderNumber = row['주문번호'];
                        const isSending = sendingRows[rowIndex];
                        const isFailed = failedRows[rowIndex];
                        const isOnlyGeneral = row.reasons.length === 1 && row.reasons[0] === '기타';
                        // historyTick은 발송 시 리렌더를 강제하기 위한 의존성으로만 존재
                        const history = historyTick >= 0 ? getAlimtalkHistory(orderNumber) : [];

                        return (
                          <div className="flex flex-col items-center gap-1 relative group">
                            {isOnlyGeneral ? (
                              <span className="text-slate-200 text-xs">—</span>
                            ) : isSending ? (
                              <span className="text-[10px] text-indigo-500 font-black animate-pulse">발송 중...</span>
                            ) : (
                              <button
                                onClick={() => handleSendAlimtalk(row)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-colors shadow-sm ${isFailed ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900'}`}
                              >
                                {isFailed ? '🔁 재발송' : '📨 발송'}
                              </button>
                            )}
                            {history.length > 0 && (
                              <>
                                <div className="flex flex-col w-full text-center">
                                  <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded whitespace-nowrap cursor-default">
                                    ✅ {history[history.length - 1]}
                                  </span>
                                </div>
                                {history.length > 1 && (
                                  <div className="absolute top-full mt-1 z-50 hidden group-hover:flex flex-col gap-0.5 w-max bg-white border border-slate-100 rounded-lg p-1.5 shadow-xl">
                                    <div className="text-[8px] font-black text-slate-400 mb-0.5 text-center px-1">전체 발송 이력</div>
                                    {[...history].reverse().map((ts, idx) => (
                                      <span key={idx} className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-center whitespace-nowrap">
                                        ✅ {ts}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
              {stuckCases.length === 0 && (
                <tr><td colSpan={11} className="p-20 text-center text-slate-300 italic text-lg">
                  해당 조건에 맞는 지연 내역이 없습니다.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* ── 전체 발송 이력 모달 ───────────────────────────────────────── */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <Icon name="history" className="text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">알림톡 발송 이력</h3>
                  <p className="text-xs text-slate-500 font-medium">로컬에 저장된 주문별 전체 발송 타임스탬프입니다.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Icon name="close" className="text-lg" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50 inset-shadow-sm flex-1">
              {(() => {
                const allHist = getAllHistory();
                if (allHist.length === 0) {
                  return (
                    <div className="text-center py-10 flex flex-col items-center justify-center text-slate-400">
                      <Icon name="inbox" className="text-4xl mb-3 opacity-20" />
                      <p className="text-sm font-bold">발송 이력이 없습니다.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    {allHist.map((item, id) => (
                      <div key={id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">주문번호</p>
                          <p className="text-sm font-black text-indigo-900">{item.orderNumber}</p>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          {item.history.map((ts: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">
                              <Icon name="check_circle" className="text-[12px]" />
                              <span className="text-[10px] font-black">{ts}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
