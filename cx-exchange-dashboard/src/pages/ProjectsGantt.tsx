import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchGanttTasks, upsertGanttTask, deleteGanttTask,
  GANTT_STATUSES, GANTT_STATUS_LABELS,
} from '../api/gantt';
import type { GanttTask, GanttTaskInput, GanttStatus } from '../api/gantt';
import { useAdmin } from '../hooks/useAdmin';

// ── 시간 유틸 (전부 UTC 자정 기준 — KST 시차로 하루 밀리는 것 방지) ──
const DAY_MS = 86_400_000;
const toUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const todayIso = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // KST
  return d.toISOString().slice(0, 10);
};

// 상태별 색 (Tailwind 팔레트와 맞춘 값 — SVG라 hex 직접 사용)
const STATUS_COLOR: Record<GanttStatus, { main: string; soft: string }> = {
  done:     { main: '#0f766e', soft: '#0f766e22' }, // teal-700
  active:   { main: '#4f46e5', soft: '#4f46e522' }, // indigo-600
  blocked:  { main: '#e11d48', soft: '#e11d4822' }, // rose-600
  external: { main: '#b45309', soft: '#b4530922' }, // amber-700
  queued:   { main: '#64748b', soft: '#64748b1a' }, // slate-500
};

const DAY_W = 9;       // px per day
const ROW_H = 34;
const GROUP_H = 30;
const AXIS_H = 46;
const LABEL_W = 300;

// ── 물음표 도움말 ─────────────────────────────────────────
// 라벨은 짧게 두고(목표일/핵심 일정), 자세한 뜻은 여기서 설명한다.
const HelpTip: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={`${title} 설명`}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-4 h-4 rounded-full border border-slate-300 text-slate-400 text-[10px] font-bold leading-none flex items-center justify-center hover:border-indigo-400 hover:text-indigo-500 transition-colors"
      >
        ?
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 w-56 max-w-[80vw] bg-slate-900 text-white rounded-xl px-3.5 py-3 shadow-xl">
          <span className="block text-[11px] font-black mb-1">{title}</span>
          <span className="block text-[11px] leading-relaxed text-slate-200">{children}</span>
        </span>
      )}
    </span>
  );
};

// ── 편집 모달 ─────────────────────────────────────────────
const EMPTY_DRAFT: GanttTaskInput = {
  group: '', name: '', start: todayIso(), end: todayIso(),
  status: 'queued', progress: 0, deps: [], milestone: false, critical: false, note: '',
};

const TaskModal: React.FC<{
  draft: GanttTaskInput;
  groups: string[];
  allTasks: GanttTask[];
  adminKey: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ draft, groups, allTasks, adminKey, onClose, onSaved }) => {
  const [t, setT] = useState<GanttTaskInput>({ ...draft });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!draft.id;
  const set = <K extends keyof GanttTaskInput>(k: K, v: GanttTaskInput[K]) =>
    setT((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    const payload: GanttTaskInput = { ...t };
    if (payload.milestone) payload.end = '';
    const r = await upsertGanttTask(payload, adminKey);
    setSaving(false);
    if (!r.ok) { setError(r.error || '저장 실패'); return; }
    onSaved();
  };

  const remove = async () => {
    if (!t.id || saving) return;
    if (!window.confirm(`'${t.name}' 작업을 삭제할까요?`)) return;
    setSaving(true);
    const r = await deleteGanttTask(t.id, adminKey);
    setSaving(false);
    if (!r.ok) { setError(r.error || '삭제 실패'); return; }
    onSaved();
  };

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 transition-colors bg-white';
  const labelCls = 'block text-[11px] font-bold text-slate-500 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-base font-black text-slate-900 mb-5">{isEdit ? '작업 수정' : '새 작업'}</p>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>이름 *</label>
            <input className={inputCls} value={t.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="작업 이름" />
          </div>

          <div>
            <label className={labelCls}>그룹</label>
            <input className={inputCls} value={t.group || ''} onChange={(e) => set('group', e.target.value)}
              list="gantt-groups" placeholder="예: 교환 데이터 (새 이름을 쓰면 새 그룹)" />
            <datalist id="gantt-groups">
              {groups.map((gr) => <option key={gr} value={gr} />)}
            </datalist>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>시작일 *</label>
              <input type="date" className={inputCls} value={t.start || ''} onChange={(e) => set('start', e.target.value)} />
            </div>
            {!t.milestone && (
              <div className="flex-1">
                <label className={labelCls}>종료일 *</label>
                <input type="date" className={inputCls} value={t.end || ''} onChange={(e) => set('end', e.target.value)} />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>상태</label>
              <select className={inputCls} value={t.status || 'queued'} onChange={(e) => set('status', e.target.value as GanttStatus)}>
                {GANTT_STATUSES.map((s) => <option key={s} value={s}>{GANTT_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            {!t.milestone && (
              <div className="flex-1">
                <label className={labelCls}>진행률 (%)</label>
                <input type="number" min={0} max={100} className={inputCls}
                  value={t.progress ?? 0} onChange={(e) => set('progress', Number(e.target.value))} />
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>선행 작업 (이게 끝나야 시작)</label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {allTasks.filter((o) => o.id !== t.id).map((o) => {
                const on = (t.deps || []).includes(o.id);
                return (
                  <button key={o.id} type="button"
                    onClick={() => set('deps', on ? (t.deps || []).filter((d) => d !== o.id) : [...(t.deps || []), o.id])}
                    className={`text-[11px] font-semibold rounded-md px-2 py-1 border transition-colors ${
                      on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                    }`}>
                    {o.name.length > 18 ? o.name.slice(0, 18) + '…' : o.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={!!t.milestone} onChange={(e) => set('milestone', e.target.checked)} />
                목표일 ◆
              </label>
              <HelpTip title="목표일 ◆">
                며칠 걸리는 "일"이 아니라, 특정 날짜에 딱 일어나는 "사건"이에요.
                승인·납품·권한 부여 같은 것. 켜면 종료일과 진행률 칸이 사라지고,
                막대 대신 ◆ 하나로 찍힙니다.
              </HelpTip>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={!!t.critical} onChange={(e) => set('critical', e.target.checked)} />
                핵심 일정 ●
              </label>
              <HelpTip title="핵심 일정 ●">
                이게 밀리면 뒤에 물린 일이 전부 같이 밀리는 작업이에요.
                켜면 이름 옆에 보라색 점이 붙고, 앞뒤가 둘 다 켜져 있으면
                그 사이 화살표가 굵은 실선으로 강조됩니다. 바쁠 때 먼저 할 일.
              </HelpTip>
            </div>
          </div>

          <div>
            <label className={labelCls}>메모</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={t.note || ''}
              onChange={(e) => set('note', e.target.value)} placeholder="막힌 이유, 참고사항 등" />
          </div>
        </div>

        {error && <p className="text-xs text-rose-600 mt-3">{error}</p>}

        <div className="flex items-center justify-between mt-6">
          {isEdit ? (
            <button type="button" onClick={() => void remove()} disabled={saving}
              className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors disabled:opacity-40">
              삭제
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="text-xs font-semibold text-slate-400 hover:text-slate-700 px-3 py-2 transition-colors">
              취소
            </button>
            <button type="button" onClick={() => void save()} disabled={saving || !t.name?.trim()}
              className="text-xs font-bold bg-indigo-600 text-white rounded-xl px-4 py-2 disabled:opacity-40 hover:bg-indigo-500 transition-colors">
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 간트 SVG ─────────────────────────────────────────────
const GanttChart: React.FC<{
  tasks: GanttTask[];
  onSelect: (t: GanttTask) => void;
}> = ({ tasks, onSelect }) => {
  // 그룹 순서 = 시트 정렬 순서에서 처음 등장한 순서
  const groups = useMemo(() => {
    const seen: string[] = [];
    tasks.forEach((t) => { if (!seen.includes(t.group)) seen.push(t.group); });
    return seen;
  }, [tasks]);

  // 타임라인 범위: 최소 시작 ~ 최대 종료 + 여유, 월요일 스냅
  const { t0, days } = useMemo(() => {
    const today = toUtc(todayIso());
    let min = today, max = today;
    tasks.forEach((t) => {
      const s = toUtc(t.start);
      const e = t.end ? toUtc(t.end) : s;
      if (s < min) min = s;
      if (e > max) max = e;
    });
    min -= 4 * DAY_MS;
    max += 7 * DAY_MS;
    // 월요일로 스냅 (getUTCDay: 월=1)
    const d = new Date(min);
    const shift = (d.getUTCDay() + 6) % 7;
    min -= shift * DAY_MS;
    return { t0: min, days: Math.ceil((max - min) / DAY_MS) };
  }, [tasks]);

  const xd = (iso: string) => ((toUtc(iso) - t0) / DAY_MS) * DAY_W;

  // 행 레이아웃
  type Row = { type: 'g'; label: string; y: number } | { type: 't'; task: GanttTask; y: number };
  const { rows, height } = useMemo(() => {
    let y = 0;
    const out: Row[] = [];
    groups.forEach((gr) => {
      out.push({ type: 'g', label: gr, y });
      y += GROUP_H;
      tasks.filter((t) => t.group === gr).forEach((t) => {
        out.push({ type: 't', task: t, y });
        y += ROW_H;
      });
    });
    return { rows: out, height: y };
  }, [groups, tasks]);

  const byId = useMemo(() => {
    const m = new Map<string, { task: GanttTask; y: number }>();
    rows.forEach((r) => { if (r.type === 't') m.set(r.task.id, { task: r.task, y: r.y }); });
    return m;
  }, [rows]);

  const W = days * DAY_W;
  const H = AXIS_H + height;
  const todayX = xd(todayIso()) + DAY_W / 2;

  const weekTicks = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    for (let i = 0; i < days; i++) {
      const ms = t0 + i * DAY_MS;
      if (new Date(ms).getUTCDay() === 1) {
        const d = new Date(ms);
        out.push({ x: i * DAY_W, label: `${d.getUTCMonth() + 1}/${String(d.getUTCDate()).padStart(2, '0')}` });
      }
    }
    return out;
  }, [t0, days]);

  const monthTicks = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(t0 + i * DAY_MS);
      if (d.getUTCDate() === 1 || i === 0) out.push({ x: i * DAY_W, label: `${d.getUTCMonth() + 1}월` });
    }
    return out;
  }, [t0, days]);

  const [hoverId, setHoverId] = useState<string | null>(null);

  return (
    <div className="grid" style={{ gridTemplateColumns: `min(${LABEL_W}px, 42vw) minmax(0, 1fr)` }}>
      {/* 왼쪽 라벨 */}
      <div className="relative border-r border-slate-200 bg-white" style={{ height: H }}>
        <div style={{ height: AXIS_H }} className="border-b border-slate-200" />
        {rows.map((r) =>
          r.type === 'g' ? (
            <div key={`g-${r.label}`}
              className="absolute inset-x-0 flex items-end px-4 pb-1.5 text-[10px] font-black tracking-widest text-slate-400 uppercase border-t border-slate-100"
              style={{ top: AXIS_H + r.y, height: GROUP_H }}>
              {r.label}
            </div>
          ) : (
            <button key={r.task.id} type="button" onClick={() => onSelect(r.task)}
              onMouseEnter={() => setHoverId(r.task.id)} onMouseLeave={() => setHoverId(null)}
              className={`absolute inset-x-0 flex items-center gap-2 px-4 text-left transition-colors ${
                hoverId === r.task.id ? 'bg-indigo-50' : ''
              }`}
              style={{ top: AXIS_H + r.y, height: ROW_H }}>
              <span className="text-[13px] text-slate-800 truncate">{r.task.name}</span>
              {r.task.critical && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
            </button>
          ),
        )}
      </div>

      {/* 오른쪽 차트 */}
      <div className="overflow-x-auto">
        <svg width={W + 20} height={H} className="block">
          <g transform="translate(10,0)">
            {/* 주말 음영 + 주 격자 */}
            {Array.from({ length: days }, (_, i) => {
              const dow = new Date(t0 + i * DAY_MS).getUTCDay();
              return (dow === 0 || dow === 6) ? (
                <rect key={i} x={i * DAY_W} y={AXIS_H} width={DAY_W} height={height} fill="#0f172a08" />
              ) : null;
            })}
            {weekTicks.map((w) => (
              <g key={w.x}>
                <line x1={w.x} y1={AXIS_H - 14} x2={w.x} y2={H} stroke="#e2e8f0" strokeWidth={1} />
                <text x={w.x + 4} y={AXIS_H - 4} fontSize={9.5} fill="#94a3b8" fontFamily="ui-monospace, monospace">{w.label}</text>
              </g>
            ))}
            {monthTicks.map((m) => (
              <text key={m.x} x={m.x + 5} y={16} fontSize={11} fontWeight={700} fill="#475569" fontFamily="ui-monospace, monospace">{m.label}</text>
            ))}
            <line x1={0} y1={AXIS_H} x2={W} y2={AXIS_H} stroke="#e2e8f0" />

            {/* 그룹 구분선 */}
            {rows.filter((r) => r.type === 'g').map((r) => (
              <line key={`gl-${r.y}`} x1={0} y1={AXIS_H + r.y} x2={W} y2={AXIS_H + r.y} stroke="#f1f5f9" />
            ))}

            {/* 오늘선 */}
            <line x1={todayX} y1={AXIS_H - 18} x2={todayX} y2={H} stroke="#4f46e5" strokeWidth={1.2} strokeDasharray="3 3" />
            <text x={todayX} y={AXIS_H - 22} fontSize={9.5} fontWeight={700} fill="#4f46e5" textAnchor="middle" fontFamily="ui-monospace, monospace">오늘</text>

            {/* 의존선 */}
            {rows.map((r) => {
              if (r.type !== 't' || !r.task.deps.length) return null;
              return r.task.deps.map((pid) => {
                const p = byId.get(pid);
                if (!p) return null;
                const isCrit = r.task.critical && p.task.critical;
                const sx = p.task.milestone ? xd(p.task.start) + DAY_W / 2 + 8 : xd(p.task.end || p.task.start) + DAY_W;
                const sy = AXIS_H + p.y + ROW_H / 2;
                const ex = xd(r.task.start);
                const ey = AXIS_H + r.y + ROW_H / 2;
                return (
                  <g key={`${pid}->${r.task.id}`}>
                    <path d={`M${sx},${sy} H${sx + 10} V${ey} H${ex - 4}`} fill="none"
                      stroke={isCrit ? '#4f46e5' : '#cbd5e1'} strokeWidth={isCrit ? 1.6 : 1.1}
                      strokeDasharray={isCrit ? undefined : '3 2.5'} />
                    <path d={`M${ex - 4},${ey - 3.5} L${ex + 1},${ey} L${ex - 4},${ey + 3.5} z`}
                      fill={isCrit ? '#4f46e5' : '#cbd5e1'} />
                  </g>
                );
              });
            })}

            {/* 막대 / 마일스톤 */}
            {rows.map((r) => {
              if (r.type !== 't') return null;
              const t = r.task;
              const cy = AXIS_H + r.y + ROW_H / 2;
              const col = STATUS_COLOR[t.status] || STATUS_COLOR.queued;
              const label = [
                t.name,
                t.milestone ? `목표일 · ${t.start}` : `${t.start} → ${t.end}`,
                `상태: ${GANTT_STATUS_LABELS[t.status] || t.status}${t.progress > 0 ? ` · ${t.progress}%` : ''}`,
                t.note,
              ].filter(Boolean).join('\n');

              if (t.milestone) {
                const mx = xd(t.start) + DAY_W / 2;
                return (
                  <g key={t.id} className="cursor-pointer" onClick={() => onSelect(t)}
                    onMouseEnter={() => setHoverId(t.id)} onMouseLeave={() => setHoverId(null)}>
                    <rect x={-10} y={AXIS_H + r.y} width={W + 20} height={ROW_H}
                      fill={hoverId === t.id ? '#4f46e510' : 'transparent'} />
                    <path d={`M${mx},${cy - 7} l7,7 l-7,7 l-7,-7 z`}
                      fill={t.status === 'external' ? STATUS_COLOR.external.main : '#475569'} />
                    <text x={mx + 13} y={cy + 3.5} fontSize={9.5} fill="#94a3b8" fontFamily="ui-monospace, monospace">
                      {t.start.slice(5).replace('-', '/')}
                    </text>
                    <title>{label}</title>
                  </g>
                );
              }

              const bx = xd(t.start);
              const bw = Math.max(xd(t.end || t.start) + DAY_W - bx, 4);
              const bh = 16;
              const dcount = Math.round(bw / DAY_W);
              return (
                <g key={t.id} className="cursor-pointer" onClick={() => onSelect(t)}
                  onMouseEnter={() => setHoverId(t.id)} onMouseLeave={() => setHoverId(null)}>
                  <rect x={-10} y={AXIS_H + r.y} width={W + 20} height={ROW_H}
                    fill={hoverId === t.id ? '#4f46e510' : 'transparent'} />
                  <rect x={bx} y={cy - bh / 2} width={bw} height={bh} rx={3.5}
                    fill={col.soft} stroke={col.main} strokeWidth={1} />
                  {t.progress > 0 && (
                    <rect x={bx} y={cy - bh / 2} width={Math.max((bw * t.progress) / 100, 2)} height={bh} rx={3.5} fill={col.main} />
                  )}
                  {bw >= 40 && (
                    <text x={bx + bw - 6} y={cy + 3.5} fontSize={9.5} textAnchor="end"
                      fill={t.progress > 90 ? '#ffffff' : '#94a3b8'} fontFamily="ui-monospace, monospace">
                      {dcount}일{t.progress > 0 && t.progress < 100 ? ` · ${t.progress}%` : ''}
                    </text>
                  )}
                  <title>{label}</title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};

// ── 페이지 ───────────────────────────────────────────────
export const ProjectsGantt: React.FC = () => {
  const { isAdmin, checking, adminKey, login } = useAdmin();
  const [tasks, setTasks] = useState<GanttTask[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<GanttTaskInput | null>(null);

  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const reload = useCallback(async () => {
    const t = await fetchGanttTasks();
    if (t === null) setLoadError(true);
    else { setTasks(t); setLoadError(false); }
  }, []);

  useEffect(() => { if (isAdmin) void reload(); }, [isAdmin, reload]);

  const groups = useMemo(() => {
    const seen: string[] = [];
    (tasks || []).forEach((t) => { if (!seen.includes(t.group)) seen.push(t.group); });
    return seen;
  }, [tasks]);

  const statusCounts = useMemo(() => {
    const c: Partial<Record<GanttStatus, number>> = {};
    (tasks || []).forEach((t) => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [tasks]);

  // 관리자 게이트 — 메뉴가 안 보여도 URL 직접 진입이 가능하므로 페이지에서도 막는다
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 w-full max-w-sm text-center">
          <p className="text-lg font-black text-slate-900 mb-1">프로젝트 로드맵</p>
          {checking ? (
            <p className="text-sm text-slate-400 mt-4">관리자 확인 중…</p>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-5">관리자 전용 화면입니다.</p>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key !== 'Enter' || !keyInput.trim() || verifying) return;
                  setVerifying(true);
                  const ok = await login(keyInput.trim());
                  setVerifying(false);
                  if (!ok) setKeyError('키가 올바르지 않습니다.');
                }}
                placeholder="관리자 키 입력 후 Enter"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
              />
              {keyError && <p className="text-xs text-rose-600 mt-2">{keyError}</p>}
              {verifying && <p className="text-xs text-slate-400 mt-2">확인 중…</p>}
              <Link to="/" className="inline-block text-xs font-semibold text-slate-400 hover:text-slate-700 mt-5 transition-colors">
                ← 홈으로
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors mb-2">
              ← 홈으로
            </Link>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">프로젝트 로드맵</h1>
            <p className="text-sm text-slate-500 mt-1">
              막대를 클릭하면 수정할 수 있어요. 날짜는 추정치 — 실제 일정에 맞춰 계속 고쳐 쓰는 문서입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY_DRAFT, group: groups[groups.length - 1] || '' })}
            className="shrink-0 bg-indigo-600 text-white rounded-xl px-4 py-2 text-xs font-black hover:bg-indigo-500 transition-colors"
          >
            + 새 작업
          </button>
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4">
          {GANTT_STATUSES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-5 h-2.5 rounded-sm" style={{ background: STATUS_COLOR[s].soft, border: `1px solid ${STATUS_COLOR[s].main}` }} />
              {GANTT_STATUS_LABELS[s]}
              {statusCounts[s] ? <span className="text-slate-400">({statusCounts[s]})</span> : null}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 bg-slate-600 rotate-45 rounded-[1px]" /> 목표일
            <HelpTip title="목표일 ◆">
              며칠 걸리는 "일"이 아니라 특정 날짜에 딱 일어나는 "사건"이에요.
              승인·납품·권한 부여 같은 것. 기간이 없어서 ◆ 하나로 찍힙니다.
            </HelpTip>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 핵심 일정
            <HelpTip title="핵심 일정 ●">
              이게 밀리면 뒤에 물린 일이 전부 같이 밀리는 작업이에요.
              점끼리 이어진 화살표가 굵은 실선으로 강조됩니다. 바쁠 때 먼저 할 일.
            </HelpTip>
          </span>
        </div>

        {/* 차트 */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {tasks === null ? (
            <p className="text-sm text-slate-400 text-center py-20">
              {loadError ? '데이터를 불러오지 못했습니다. 새로고침 해주세요.' : '불러오는 중…'}
            </p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-20">작업이 없습니다. "+ 새 작업"으로 시작하세요.</p>
          ) : (
            <GanttChart tasks={tasks} onSelect={(t) => setDraft({ ...t })} />
          )}
        </div>
      </div>

      {draft && (
        <TaskModal
          draft={draft}
          groups={groups}
          allTasks={tasks || []}
          adminKey={adminKey}
          onClose={() => setDraft(null)}
          onSaved={async () => { setDraft(null); await reload(); }}
        />
      )}
    </div>
  );
};

export default ProjectsGantt;
