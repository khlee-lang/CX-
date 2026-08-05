// 세일즈 뷰 "수정 요청" 시스템 UI (리터니즈 소통 화면 참고, 2026-08-05 기획 확정)
//
// - FeedbackProvider: 상태 보관 (요청/메시지, 섹션 선택 모드, 드로어, 관리자 모드)
// - FeedbackSection:  대시보드 섹션 래퍼 — 선택 모드일 때 점선 하이라이트 + 클릭으로 요청 작성
// - FeedbackButton:   헤더 버튼 (미완료 배지) → 드로어 열기
// - 드로어: 요청 목록 ↔ 채팅 스레드(말머리 탭 / 시스템 메시지 / 관리자 배지 / 상태 변경)
//
// 권한: 메시지는 누구나(이름 입력, 기기에 기억), 상태 변경은 관리자 키 인증 기기만.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import {
  fetchFeedback,
  createFeedbackRequest,
  sendFeedbackMessage,
  changeFeedbackStatus,
  verifyAdminKey,
  FEEDBACK_STATUSES,
  FEEDBACK_TAGS,
  type FeedbackData,
  type FeedbackRequest,
  type FeedbackStatus,
  type FeedbackTag,
} from '../../api/feedback';

const NAME_KEY = 'cx.feedback.name';
const ADMIN_KEY_KEY = 'cx.feedback.adminKey';
const PAGE = '/sales';
// 관리자 모드에서 보내는 모든 메시지는 이 이름으로 고정된다 (강희님 확정).
const ADMIN_NAME = '이강희';

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  요청중: 'bg-indigo-50 text-indigo-600',
  확인중: 'bg-amber-50 text-amber-600',
  수정중: 'bg-sky-50 text-sky-600',
  완료: 'bg-emerald-50 text-emerald-600',
  반려: 'bg-rose-50 text-rose-600',
};

interface Ctx {
  selectMode: boolean;
  startSelect: () => void;
  cancelSelect: () => void;
  pickSection: (label: string) => void;
  openDrawer: () => void;
  openCount: number;
}

const FeedbackCtx = createContext<Ctx | null>(null);
const useFeedback = () => {
  const ctx = useContext(FeedbackCtx);
  if (!ctx) throw new Error('FeedbackProvider 밖에서 사용됨');
  return ctx;
};

// ── 섹션 래퍼 ─────────────────────────────────────────────────
export const FeedbackSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const { selectMode, pickSection } = useFeedback();
  return (
    <div className="relative">
      {children}
      {selectMode && (
        <button
          onClick={() => pickSection(label)}
          className="absolute inset-0 z-40 rounded-[32px] border-2 border-dashed border-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/15 transition-colors group"
        >
          <span className="absolute top-3 left-4 bg-indigo-600 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-lg group-hover:scale-105 transition-transform">
            {label} 선택
          </span>
        </button>
      )}
    </div>
  );
};

// ── 헤더 버튼 ─────────────────────────────────────────────────
export const FeedbackButton: React.FC = () => {
  const { openDrawer, openCount } = useFeedback();
  return (
    <button
      onClick={openDrawer}
      className="relative flex items-center gap-1.5 bg-indigo-600 text-white rounded-xl px-4 py-2 text-xs font-black hover:bg-indigo-500 transition-colors"
    >
      <Icon name="rate_review" className="text-base leading-none" />
      수정 요청
      {openCount > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
          {openCount}
        </span>
      )}
    </button>
  );
};

// ── 프로바이더 + 드로어 + 모달 ────────────────────────────────
export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftSection, setDraftSection] = useState<string | null>(null); // 작성 모달 대상 섹션

  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(ADMIN_KEY_KEY) || '');
  const [isAdmin, setIsAdmin] = useState(false);

  const reload = useCallback(async () => {
    const d = await fetchFeedback();
    if (d) setData(d);
  }, []);

  // 최초 1회 + 드로어 열려있는 동안 60초 폴링
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!drawerOpen) return;
    void reload();
    const t = setInterval(() => void reload(), 60_000);
    return () => clearInterval(t);
  }, [drawerOpen, reload]);

  // 저장된 관리자 키 자동 검증 (서버 검증이라 키만 안다고 우회 불가)
  useEffect(() => {
    if (!adminKey) { setIsAdmin(false); return; }
    let cancelled = false;
    void verifyAdminKey(adminKey).then((ok) => { if (!cancelled) setIsAdmin(ok); });
    return () => { cancelled = true; };
  }, [adminKey]);

  // ESC로 섹션 선택 모드 취소
  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectMode(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectMode]);

  const openCount = useMemo(
    () => (data?.requests || []).filter((r) => r.status !== '완료' && r.status !== '반려').length,
    [data],
  );

  const ctx: Ctx = useMemo(() => ({
    selectMode,
    startSelect: () => { setDrawerOpen(false); setSelectMode(true); },
    cancelSelect: () => setSelectMode(false),
    pickSection: (label) => { setSelectMode(false); setDraftSection(label); },
    openDrawer: () => { setDrawerOpen(true); setActiveId(null); },
    openCount,
  }), [selectMode, openCount]);

  const saveName = (v: string) => { setName(v); localStorage.setItem(NAME_KEY, v); };
  const saveAdminKey = (v: string) => { setAdminKey(v); localStorage.setItem(ADMIN_KEY_KEY, v); };

  return (
    <FeedbackCtx.Provider value={ctx}>
      {children}

      {selectMode && (
        <div className="fixed top-0 inset-x-0 z-50 flex justify-center pt-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-slate-900 text-white rounded-2xl px-5 py-3 shadow-2xl">
            <span className="text-xs font-black">수정을 요청할 섹션을 클릭하세요</span>
            <button onClick={() => setSelectMode(false)} className="text-[11px] font-black text-slate-400 hover:text-white transition-colors">
              취소 (ESC)
            </button>
          </div>
        </div>
      )}

      {draftSection && (
        <CreateModal
          section={draftSection}
          name={name}
          onSaveName={saveName}
          adminKey={isAdmin ? adminKey : undefined}
          onClose={() => setDraftSection(null)}
          onCreated={async (id) => {
            setDraftSection(null);
            await reload();
            setDrawerOpen(true);
            setActiveId(id);
          }}
        />
      )}

      {drawerOpen && (
        <Drawer
          data={data}
          activeId={activeId}
          setActiveId={setActiveId}
          onClose={() => setDrawerOpen(false)}
          onNewRequest={ctx.startSelect}
          name={name}
          onSaveName={saveName}
          isAdmin={isAdmin}
          adminKey={adminKey}
          onSaveAdminKey={saveAdminKey}
          setIsAdmin={setIsAdmin}
          reload={reload}
        />
      )}
    </FeedbackCtx.Provider>
  );
};

// ── 요청 작성 모달 ────────────────────────────────────────────
const CreateModal: React.FC<{
  section: string;
  name: string;
  onSaveName: (v: string) => void;
  adminKey?: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}> = ({ section, name, onSaveName, adminKey, onClose, onCreated }) => {
  const isAdmin = !!adminKey;
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState(isAdmin ? ADMIN_NAME : name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const finalAuthor = isAdmin ? ADMIN_NAME : author.trim();
    if (!finalAuthor || !content.trim() || busy) return;
    setBusy(true);
    setError('');
    const r = await createFeedbackRequest({ page: PAGE, section, author: finalAuthor, content: content.trim(), adminKey });
    setBusy(false);
    if (!r.ok || !r.id) { setError(r.error || '등록에 실패했습니다.'); return; }
    if (!isAdmin) onSaveName(finalAuthor);
    onCreated(r.id);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-[480px] p-7" onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">새 수정 요청</p>
        <h3 className="text-lg font-black text-slate-900 mb-5">
          <span className="text-indigo-600">{section}</span> 섹션
        </h3>
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="이 섹션을 이렇게 수정해주세요..."
          rows={5}
          className="w-full border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-indigo-400 resize-none"
        />
        <div className="flex items-center gap-3 mt-4">
          {isAdmin ? (
            <span className="flex items-center gap-1 text-xs font-black text-slate-500 bg-slate-100 rounded-xl px-3 py-2.5">
              <Icon name="verified_user" className="text-sm leading-none" /> {ADMIN_NAME}
            </span>
          ) : (
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="이름"
              className="w-32 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-400"
            />
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="text-xs font-black text-slate-400 hover:text-slate-600 px-3 py-2.5">취소</button>
          <button
            onClick={submit}
            disabled={(!isAdmin && !author.trim()) || !content.trim() || busy}
            className="bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-xs font-black hover:bg-indigo-500 transition-colors disabled:opacity-40"
          >
            {busy ? '등록 중...' : '요청 등록'}
          </button>
        </div>
        {error && <p className="text-[11px] font-bold text-rose-500 mt-3">{error}</p>}
      </div>
    </div>
  );
};

// ── 드로어 (목록 ↔ 스레드) ────────────────────────────────────
const Drawer: React.FC<{
  data: FeedbackData | null;
  activeId: string | null;
  setActiveId: (v: string | null) => void;
  onClose: () => void;
  onNewRequest: () => void;
  name: string;
  onSaveName: (v: string) => void;
  isAdmin: boolean;
  adminKey: string;
  onSaveAdminKey: (v: string) => void;
  setIsAdmin: (v: boolean) => void;
  reload: () => Promise<void>;
}> = (p) => {
  const requests = useMemo(
    () => [...(p.data?.requests || [])].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [p.data],
  );
  const active = requests.find((r) => r.id === p.activeId) ?? null;

  return (
    <div className="fixed inset-0 z-50" onClick={p.onClose}>
      <div className="absolute inset-0 bg-slate-900/30" />
      <div
        className="absolute right-0 top-0 h-full w-full max-w-[440px] bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {active ? (
          <Thread
            request={active}
            messages={(p.data?.messages || []).filter((m) => m.requestId === active.id)}
            onBack={() => p.setActiveId(null)}
            name={p.name}
            onSaveName={p.onSaveName}
            isAdmin={p.isAdmin}
            adminKey={p.adminKey}
            reload={p.reload}
          />
        ) : (
          <RequestList
            requests={requests}
            messages={p.data?.messages || []}
            loaded={p.data != null}
            onSelect={p.setActiveId}
            onClose={p.onClose}
            onNewRequest={p.onNewRequest}
            isAdmin={p.isAdmin}
            adminKey={p.adminKey}
            onSaveAdminKey={p.onSaveAdminKey}
            setIsAdmin={p.setIsAdmin}
          />
        )}
      </div>
    </div>
  );
};

const RequestList: React.FC<{
  requests: FeedbackRequest[];
  messages: FeedbackData['messages'];
  loaded: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  onNewRequest: () => void;
  isAdmin: boolean;
  adminKey: string;
  onSaveAdminKey: (v: string) => void;
  setIsAdmin: (v: boolean) => void;
}> = (p) => {
  const [keyDraft, setKeyDraft] = useState('');
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyError, setKeyError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | '전체'>('전체');
  const [authorFilter, setAuthorFilter] = useState<string>('전체');

  const lastMsgOf = (id: string) => {
    const list = p.messages.filter((m) => m.requestId === id && m.role !== 'system');
    return list[list.length - 1]?.content || '';
  };

  const authors = useMemo(
    () => [...new Set(p.requests.map((r) => r.author).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')),
    [p.requests],
  );

  const filtered = useMemo(
    () =>
      p.requests.filter(
        (r) => (statusFilter === '전체' || r.status === statusFilter) && (authorFilter === '전체' || r.author === authorFilter),
      ),
    [p.requests, statusFilter, authorFilter],
  );

  const tryKey = async () => {
    if (!keyDraft.trim() || busy) return;
    setBusy(true);
    const ok = await verifyAdminKey(keyDraft.trim());
    setBusy(false);
    if (ok) {
      p.onSaveAdminKey(keyDraft.trim());
      p.setIsAdmin(true);
      setKeyOpen(false);
      setKeyDraft('');
      setKeyError(false);
    } else {
      setKeyError(true);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
        <div>
          <h3 className="font-black text-slate-900">수정 요청</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Feedback · {PAGE}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={p.onNewRequest}
            className="bg-indigo-600 text-white rounded-xl px-3.5 py-2 text-xs font-black hover:bg-indigo-500 transition-colors"
          >
            + 새 요청
          </button>
          <button onClick={p.onClose} className="p-2 text-slate-300 hover:text-slate-500 transition-colors">
            <Icon name="close" />
          </button>
        </div>
      </div>

      {/* 이름·상태 필터 */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | '전체')}
          className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-black text-slate-600 focus:outline-none focus:border-indigo-400"
        >
          <option value="전체">상태 전체</option>
          {FEEDBACK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={authorFilter}
          onChange={(e) => setAuthorFilter(e.target.value)}
          className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-black text-slate-600 focus:outline-none focus:border-indigo-400"
        >
          <option value="전체">이름 전체</option>
          {authors.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {(statusFilter !== '전체' || authorFilter !== '전체') && (
          <button
            onClick={() => { setStatusFilter('전체'); setAuthorFilter('전체'); }}
            className="text-[10px] font-bold text-slate-300 hover:text-slate-500 shrink-0"
          >
            초기화
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!p.loaded && <p className="p-6 text-xs font-bold text-slate-400 animate-pulse">불러오는 중...</p>}
        {p.loaded && p.requests.length === 0 && (
          <div className="p-10 text-center">
            <Icon name="rate_review" className="text-5xl text-slate-100 mb-3" />
            <p className="text-xs font-bold text-slate-400">아직 요청이 없습니다. "+ 새 요청"으로 시작하세요.</p>
          </div>
        )}
        {p.loaded && p.requests.length > 0 && filtered.length === 0 && (
          <p className="p-6 text-xs font-bold text-slate-400 text-center">조건에 맞는 요청이 없습니다.</p>
        )}
        {filtered.map((r) => (
          <button
            key={r.id}
            onClick={() => p.onSelect(r.id)}
            className="w-full text-left px-6 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-black text-slate-800">{r.section}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 ${STATUS_STYLE[r.status] ?? 'bg-slate-100 text-slate-500'}`}>
                {r.status}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 truncate">{lastMsgOf(r.id) || '(내용 없음)'}</p>
            <p className="text-[10px] font-bold text-slate-300 mt-1">{r.author} · {r.updatedAt}</p>
          </button>
        ))}
      </div>

      {/* 관리자 모드 */}
      <div className="border-t border-slate-100 px-6 py-4">
        {p.isAdmin ? (
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-600 flex items-center gap-1">
              <Icon name="verified_user" className="text-sm leading-none" /> 관리자 모드
            </span>
            <button
              onClick={() => { p.onSaveAdminKey(''); p.setIsAdmin(false); }}
              className="text-[10px] font-bold text-slate-300 hover:text-slate-500"
            >
              해제
            </button>
          </div>
        ) : keyOpen ? (
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={keyDraft}
              onChange={(e) => { setKeyDraft(e.target.value); setKeyError(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void tryKey(); }}
              placeholder="관리자 키"
              className={`flex-1 border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none ${keyError ? 'border-rose-300' : 'border-slate-200 focus:border-indigo-400'}`}
            />
            <button onClick={() => void tryKey()} disabled={busy} className="text-xs font-black text-indigo-600 disabled:opacity-40">
              {busy ? '확인 중' : '인증'}
            </button>
          </div>
        ) : (
          <button onClick={() => setKeyOpen(true)} className="text-[10px] font-bold text-slate-300 hover:text-slate-500">
            관리자 모드
          </button>
        )}
        {keyError && <p className="text-[10px] font-bold text-rose-500 mt-1">키가 일치하지 않습니다.</p>}
      </div>
    </>
  );
};

// ── 채팅 스레드 ───────────────────────────────────────────────
const Thread: React.FC<{
  request: FeedbackRequest;
  messages: FeedbackData['messages'];
  onBack: () => void;
  name: string;
  onSaveName: (v: string) => void;
  isAdmin: boolean;
  adminKey: string;
  reload: () => Promise<void>;
}> = (p) => {
  const [tag, setTag] = useState<FeedbackTag>('수정요청');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState(p.isAdmin ? ADMIN_NAME : p.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [p.messages.length]);

  // 관리자 모드 진입/해제 시 이름 입력값을 그에 맞게 강제 전환
  useEffect(() => {
    setAuthor(p.isAdmin ? ADMIN_NAME : p.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.isAdmin]);

  const send = async () => {
    const finalAuthor = p.isAdmin ? ADMIN_NAME : author.trim();
    if (!finalAuthor || !content.trim() || busy) return;
    setBusy(true);
    setError('');
    const r = await sendFeedbackMessage({
      requestId: p.request.id, author: finalAuthor, content: content.trim(), tag,
      adminKey: p.isAdmin ? p.adminKey : undefined,
    });
    setBusy(false);
    if (!r.ok) { setError(r.error || '전송 실패'); return; }
    if (!p.isAdmin) p.onSaveName(finalAuthor);
    setContent('');
    await p.reload();
  };

  const setStatus = async (status: FeedbackStatus) => {
    if (status === p.request.status) return;
    const r = await changeFeedbackStatus({ requestId: p.request.id, status, adminKey: p.adminKey });
    if (!r.ok) { setError(r.error || '상태 변경 실패'); return; }
    await p.reload();
  };

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <button onClick={p.onBack} className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors">
          <Icon name="arrow_back" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-900 truncate">{p.request.section}</p>
          <p className="text-[10px] font-bold text-slate-400">{p.request.author} · {p.request.createdAt}</p>
        </div>
        {p.isAdmin ? (
          <select
            value={p.request.status}
            onChange={(e) => void setStatus(e.target.value as FeedbackStatus)}
            className={`text-[11px] font-black rounded-lg px-2 py-1.5 border-0 focus:outline-none cursor-pointer ${STATUS_STYLE[p.request.status] ?? ''}`}
          >
            {FEEDBACK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${STATUS_STYLE[p.request.status] ?? ''}`}>
            {p.request.status}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-slate-50/50">
        {p.messages.map((m) =>
          m.role === 'system' ? (
            <div key={m.id} className="text-center">
              <span className="inline-block bg-slate-100 text-slate-400 text-[10px] font-bold px-3 py-1.5 rounded-full">
                [{m.at}] {m.content}
              </span>
            </div>
          ) : (
            <div key={m.id}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-black text-slate-500">{m.tag}</span>
                <span className="text-[10px] font-bold text-slate-300">|</span>
                <span className="text-[10px] font-bold text-slate-400">{m.author}</span>
                {m.role === 'admin' && (
                  <span className="text-[9px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded">관리자</span>
                )}
              </div>
              <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 text-xs font-medium leading-relaxed whitespace-pre-wrap ${
                m.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-100 text-slate-700'
              }`}>
                {m.content}
              </div>
              <p className="text-[9px] font-bold text-slate-300 mt-1">{m.at} 보냄</p>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-100 p-4">
        <div className="flex gap-1 mb-2">
          {FEEDBACK_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors ${
                tag === t ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-600 bg-slate-50'
              }`}
            >
              {t}
            </button>
          ))}
          <div className="flex-1" />
          {p.isAdmin ? (
            <span className="flex items-center gap-1 text-[11px] font-black text-slate-500 bg-slate-100 rounded-lg px-2 py-1">
              <Icon name="verified_user" className="text-xs leading-none" /> {ADMIN_NAME}
            </span>
          ) : (
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="이름"
              className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none focus:border-indigo-400"
            />
          )}
        </div>
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send(); }}
            placeholder="내용을 입력해 주세요 (⌘+Enter 전송)"
            rows={2}
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-indigo-400 resize-none"
          />
          <button
            onClick={() => void send()}
            disabled={!author.trim() || !content.trim() || busy}
            className="bg-indigo-600 text-white rounded-xl px-4 text-xs font-black hover:bg-indigo-500 transition-colors disabled:opacity-40 shrink-0"
          >
            전송
          </button>
        </div>
        {error && <p className="text-[10px] font-bold text-rose-500 mt-2">{error}</p>}
      </div>
    </>
  );
};
