import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import { sankeyNodes } from '@/mock/prototypeData';

interface DistributionFlowChartProps {
  links: { source: number; target: number; value: number }[];
}

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'rgba(15,23,42,0.9)',
  border: '1px solid rgba(148,163,184,0.4)',
  borderRadius: '0.75rem',
  color: '#e2e8f0',
  padding: '0.75rem 1rem',
};

const DistributionFlowChart = ({ links }: DistributionFlowChartProps) => (
  <div className="h-80 w-full">
    <ResponsiveContainer>
      <Sankey
        data={{ nodes: sankeyNodes, links }}
        nodePadding={36}
        nodeWidth={18}
        iterations={48}
        linkCurvature={0.5}
        margin={{ top: 0, right: 40, bottom: 0, left: 40 }}
      >
        <Tooltip
          cursor={{ stroke: '#334155', strokeWidth: 2 }}
          wrapperStyle={tooltipStyle}
          formatter={(value: number) => [`${value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`, 'Value']}
        />
      </Sankey>
    </ResponsiveContainer>
  </div>
);

export default DistributionFlowChart;
