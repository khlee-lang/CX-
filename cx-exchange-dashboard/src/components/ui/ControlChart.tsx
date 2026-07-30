import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from 'recharts';
import { ChartCard } from './ChartCard';
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_CURSOR, TOOLTIP_STYLE, SERIES_COLORS, rateTooltipFormatter } from '../../lib/chartTheme';
import { buildRateSeries, computeBand, BASELINE_START, type Granularity, type ChannelGroup, type RatePoint } from '../../lib/controlChart';
import type { ShipmentData } from '../../api/shipments';
import type { ExchangeHistoryData } from '../../api/exchangeHistory';

const GRANULARITY_LABEL: Record<Granularity, string> = { day: '일간', week: '주간', month: '월간' };

interface SeriesConfig {
  key: ChannelGroup;
  label: string;
  color: string;
}

export interface ControlChartProps {
  shipments: ShipmentData | null;
  exchangeHistory: ExchangeHistoryData | null;
  liveDaily: Map<string, Record<ChannelGroup, { exchangeCnt: number; defectCnt: number }>>;
  series?: SeriesConfig[];
  defaultGranularity?: Granularity;
}

const DEFAULT_SERIES: SeriesConfig[] = [
  { key: 'jasa', label: '자사몰', color: SERIES_COLORS.jasa },
  { key: 'oebu', label: '외부몰', color: SERIES_COLORS.oebu },
];

/**
 * 교환율 관제 그래프 — 채널그룹별 교환율 추이 + 과거 데이터(2024-07~2025-12)로 계산한
 * 평균±2σ 밴드. 밴드를 벗어난 지점은 다른 색 점으로 강조한다.
 *
 * 밴드는 "주간" 기준으로만 계산된다(일간은 요일효과, 월간은 표본 부족) — 일간/월간
 * 보기에서는 참고용으로 주간 밴드 값을 그대로 겹쳐 보여준다.
 */
export const ControlChart: React.FC<ControlChartProps> = ({
  shipments,
  exchangeHistory,
  liveDaily,
  series = DEFAULT_SERIES,
  defaultGranularity = 'week',
}) => {
  const [granularity, setGranularity] = useState<Granularity>(defaultGranularity);

  const perChannel = useMemo(() => {
    const weekly = new Map<ChannelGroup, RatePoint[]>();
    const displayed = new Map<ChannelGroup, RatePoint[]>();
    for (const s of series) {
      weekly.set(s.key, buildRateSeries(s.key, 'week', shipments, exchangeHistory, liveDaily));
      displayed.set(
        s.key,
        granularity === 'week'
          ? weekly.get(s.key)!
          : buildRateSeries(s.key, granularity, shipments, exchangeHistory, liveDaily),
      );
    }
    return { weekly, displayed };
  }, [series, shipments, exchangeHistory, liveDaily, granularity]);

  const bands = useMemo(() => {
    const m = new Map<ChannelGroup, ReturnType<typeof computeBand>>();
    for (const s of series) m.set(s.key, computeBand(perChannel.weekly.get(s.key)!));
    return m;
  }, [series, perChannel]);

  // 표시용 병합 데이터 — bucket 기준으로 채널별 rate를 한 행에 모은다
  const chartData = useMemo(() => {
    const buckets = new Set<string>();
    series.forEach((s) => perChannel.displayed.get(s.key)!.forEach((p) => buckets.add(p.bucket)));
    const sorted = [...buckets].sort();
    return sorted.map((bucket) => {
      const row: Record<string, any> = { bucket, label: bucket.slice(granularity === 'month' ? 0 : 5) };
      series.forEach((s) => {
        const p = perChannel.displayed.get(s.key)!.find((x) => x.bucket === bucket);
        row[`${s.key}_rate`] = p?.rate ?? null;
        row[`${s.key}_exceeds`] = (() => {
          const band = bands.get(s.key);
          if (!band || p?.rate == null) return null;
          // 기준선 계산 이전(램프업 구간)은 원래도 낮게 나오는 게 당연해서 강조하지 않는다.
          // "밴드 초과" 표시는 기준선을 확정한 이후(그 이후 구간 + 라이브 기간)만 의미가 있다.
          if (bucket < BASELINE_START) return null;
          return p.rate > band.upper || p.rate < band.lower ? p.rate : null;
        })();
      });
      return row;
    });
  }, [series, perChannel, bands, granularity]);

  return (
    <ChartCard
      title="교환율 관제 그래프"
      subtitle="점선=과거 데이터 기준 평균±2σ 밴드(2024-07~2025-12 76주 기준). 밴드를 벗어나면 점으로 강조됩니다."
      actions={
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-colors ${
                granularity === g ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {GRANULARITY_LABEL[g]}
            </button>
          ))}
        </div>
      }
      height={340}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval={Math.max(0, Math.ceil(chartData.length / 14) - 1)} />
          <YAxis {...AXIS_PROPS} width={36} unit="%" />
          <Tooltip cursor={TOOLTIP_CURSOR} contentStyle={TOOLTIP_STYLE} formatter={rateTooltipFormatter} />
          {series.map((s) => {
            const band = bands.get(s.key);
            if (!band) return null;
            return (
              <ReferenceArea
                key={`band-${s.key}`}
                y1={band.lower}
                y2={band.upper}
                fill={s.color}
                fillOpacity={0.06}
                ifOverflow="extendDomain"
              />
            );
          })}
          {series.map((s) => {
            const band = bands.get(s.key);
            if (!band) return null;
            return (
              <ReferenceLine
                key={`mean-${s.key}`}
                y={band.mean}
                stroke={s.color}
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
            );
          })}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={`${s.key}_rate`}
              name={`${s.label} 교환율(%)`}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 2 }}
              connectNulls={false}
            />
          ))}
          {series.map((s) => (
            <Line
              key={`${s.key}-exceed`}
              type="monotone"
              dataKey={`${s.key}_exceeds`}
              name={`${s.label} 밴드초과`}
              stroke="none"
              // null인 지점엔 점을 그리지 않는다 — 기본 dot 객체를 쓰면 recharts가
              // null 값도 0 위치에 점을 찍어버리는 문제가 있어 커스텀 렌더로 방지.
              dot={(props: any) => {
                const { cx, cy, payload, key } = props;
                if (payload?.[`${s.key}_exceeds`] == null) return <React.Fragment key={key} />;
                return <circle key={key} cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
              }}
              connectNulls={false}
              legendType="none"
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-6 mt-4 flex-wrap">
        {series.map((s) => {
          const band = bands.get(s.key);
          return (
            <div key={s.key} className="text-[10px] font-bold text-slate-400">
              <span className="font-black" style={{ color: s.color }}>{s.label}</span>{' '}
              {band ? (
                <>기준 평균 {band.mean.toFixed(2)}% · 상한 {band.upper.toFixed(2)}% · 하한 {band.lower.toFixed(2)}% (n={band.sampleSize}주)</>
              ) : (
                '기준선 계산 중 (데이터 부족)'
              )}
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
};
