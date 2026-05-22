import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  getScoreTimeline,
  getStepInsights,
  formatSessionDate,
} from '../../utils/progressMetrics';
import { useChartHeight } from '../../hooks/useBreakpoint';

const CHART_FONT = 'Lato, system-ui, sans-serif';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const product = payload.find((p) => p.dataKey === 'product');
  const tpm = payload.find((p) => p.dataKey === 'tpm');

  const lines = [];
  if (product?.payload?.productMeta) {
    const m = product.payload.productMeta;
    lines.push(
      `Session ${m.sessionNum} — Product Case — Score: ${m.score} — ${formatSessionDate(m.date)}`
    );
  }
  if (tpm?.payload?.tpmMeta) {
    const m = tpm.payload.tpmMeta;
    lines.push(
      `Session ${m.sessionNum} — TPM Case — Score: ${m.score} — ${formatSessionDate(m.date)}`
    );
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-body shadow-md max-w-xs">
      {lines.map((line) => (
        <p key={line} className="text-gray-700">
          {line}
        </p>
      ))}
    </div>
  );
}

export default function ScoreOverTimeChart({ liveSessions }) {
  const chartHeight = useChartHeight(280);

  if (liveSessions.length < 2) {
    return (
      <div className="progress-section">
        <h3 className="font-body text-lg font-semibold text-gray-800 mb-4">
          Score Over Time
        </h3>
        <p className="font-body text-sm text-gray-500 py-8 text-center">
          Keep practicing — your trend will appear here
        </p>
      </div>
    );
  }

  const { product, tpm, combined } = getScoreTimeline(liveSessions);
  const insights = getStepInsights(liveSessions);
  const chartData = combined;

  const hasProduct = product.length > 0;
  const hasTpm = tpm.length > 0;

  return (
    <div className="progress-section">
      <h3 className="font-body text-lg font-semibold text-gray-800 mb-4">
        Score Over Time
      </h3>
      <div
        className="w-full max-w-full overflow-hidden"
        style={{ background: '#fdf8f0', height: chartHeight }}
      >
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#c5d0e6" strokeDasharray="0" />
            <XAxis
              dataKey="session"
              label={{
                value: 'Session',
                position: 'insideBottom',
                offset: -4,
                style: { fontFamily: CHART_FONT, fontSize: 12 },
              }}
              tick={{ fontFamily: CHART_FONT, fontSize: 11 }}
            />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontFamily: CHART_FONT, fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            {hasProduct && hasTpm && (
              <Legend
                wrapperStyle={{ fontFamily: CHART_FONT, fontSize: 12 }}
              />
            )}
            {hasProduct && (
              <Line
                type="monotone"
                dataKey="product"
                name="Product Case"
                stroke="#4a90d9"
                strokeWidth={2}
                dot={{ r: 4, fill: '#4a90d9' }}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {hasTpm && (
              <Line
                type="monotone"
                dataKey="tpm"
                name="TPM Case"
                stroke="#7b68ee"
                strokeWidth={2}
                dot={{ r: 4, fill: '#7b68ee' }}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 desktop:grid-cols-3">
        {insights.bestStep && (
          <p className="font-body text-sm text-gray-700">
            📈 Your best step:{' '}
            <span className="font-medium">{insights.bestStep.name}</span> (
            {insights.bestStep.score} avg)
          </p>
        )}
        {insights.biggestGap && (
          <p className="font-body text-sm text-gray-700">
            🔧 Biggest gap:{' '}
            <span className="font-medium">{insights.biggestGap.name}</span> (
            {insights.biggestGap.score} avg)
          </p>
        )}
        {insights.mostImproved && (
          <p className="font-body text-sm text-gray-700">
            🔄 Most improved:{' '}
            <span className="font-medium">{insights.mostImproved.name}</span>{' '}
            (+{insights.mostImproved.delta})
          </p>
        )}
      </div>
    </div>
  );
}
