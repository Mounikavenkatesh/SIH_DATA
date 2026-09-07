import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';

const RISK_COLORS = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#06b6d4',
};

const CLASS_COLORS = [
  '#ef4444', // Potential Industrial Fire
  '#f59e0b', // Gas Flare
  '#3b82f6', // Normal/Persistent Industrial
  '#10b981', // Agricultural
  '#8b5cf6', // Other
];

export default function StatisticsPanel({ statistics }) {
  const classificationData = statistics?.charts?.classification || [];
  const riskData = statistics?.charts?.risk || [];
  const timelineData = statistics?.charts?.timeline || [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', height: '100%' }}>
      {/* 1. Classification Distribution */}
      <div className="detail-card" style={{ display: 'flex', flexDirection: 'column', height: '220px' }}>
        <div className="detail-card-title">Classification Distribution</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={classificationData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" stroke="#9ca3af" fontSize={10} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#9ca3af"
                fontSize={9}
                width={100}
                tickFormatter={(val) => (val.length > 15 ? `${val.slice(0, 15)}...` : val)}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #4b5563', borderRadius: '6px', fontSize: '11px' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {classificationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CLASS_COLORS[index % CLASS_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Risk Level Distribution */}
      <div className="detail-card" style={{ display: 'flex', flexDirection: 'column', height: '220px' }}>
        <div className="detail-card-title">Risk Level Breakdown</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={riskData}
                dataKey="count"
                nameKey="level"
                cx="50%"
                cy="50%"
                outerRadius={65}
                innerRadius={35}
                paddingAngle={4}
                label={({ level, count }) => `${level}: ${count}`}
                labelLine={false}
                fontSize={10}
              >
                {riskData.map((entry, index) => (
                  <Cell key={`risk-cell-${index}`} fill={RISK_COLORS[entry.level] || '#60a5fa'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #4b5563', borderRadius: '6px', fontSize: '11px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Detections Over Time */}
      <div className="detail-card" style={{ display: 'flex', flexDirection: 'column', height: '220px' }}>
        <div className="detail-card-title">Detections Timeline (Sept 2026)</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickFormatter={(d) => d.slice(5)} />
              <YAxis stroke="#9ca3af" fontSize={10} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #4b5563', borderRadius: '6px', fontSize: '11px' }}
              />
              <Bar dataKey="detections" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
