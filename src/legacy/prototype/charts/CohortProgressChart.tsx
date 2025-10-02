import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, Label } from 'recharts';

interface CohortEntry {
  level: string;
  survival: number;
  netValue: number;
}

interface CohortProgressChartProps {
  cohort: CohortEntry[];
}

const CohortProgressChart = ({ cohort }: CohortProgressChartProps) => (
  <div className="h-96 w-full">
    <ResponsiveContainer>
      <LineChart data={cohort} margin={{ top: 16, right: 24, left: 0, bottom: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="level" stroke="#94a3b8" tickLine={false} />
        <YAxis
          stroke="#94a3b8"
          tickLine={false}
          domain={[0, 100]}
          label={{ value: 'Survival % of Starting Dollars', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8' }}
        />
        <YAxis
          yAxisId="net"
          orientation="right"
          stroke="#34d399"
          tickLine={false}
          width={72}
          label={{ value: 'Net Value ($)', angle: 90, position: 'insideRight', offset: -5, fill: '#34d399' }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: 'rgba(15,23,42,0.92)', borderRadius: '0.75rem', border: '1px solid rgba(148,163,184,0.4)', color: '#e2e8f0' }}
          labelStyle={{ color: '#cbd5f5' }}
          formatter={(value: number, key: string) => {
            if (key === 'survival') {
              return [`${value.toFixed(1)}%`, 'Survival'];
            }
            if (key === 'netValue') {
              return [`$${value.toFixed(1)}`, 'Net Value'];
            }
            return [value, key];
          }}
        />
        <Line type="monotone" dataKey="survival" stroke="#38bdf8" strokeWidth={3} dot={{ stroke: '#0ea5e9', strokeWidth: 2 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="netValue" yAxisId="net" stroke="#34d399" strokeWidth={2} strokeDasharray="6 4" dot={false} />
        <ReferenceLine y={50} stroke="#f97316" strokeDasharray="6 6">
          <Label value="50% Survival" position="left" fill="#f97316" offset={10} />
        </ReferenceLine>
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export default CohortProgressChart;
