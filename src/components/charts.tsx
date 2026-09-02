"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#aa1945", "#b62a60", "#3b6ea5", "#4a7c59", "#c47b2b", "#6b6166"];

type NamedCount = { name: string; value: number };

export function SignupsAreaChart({ data }: { data: { day: string; count: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#aa1945" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#aa1945" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ece7e6" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b6166" }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b6166" }} tickLine={false} axisLine={false} width={28} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #ece7e6",
              boxShadow: "0 8px 24px rgba(32,26,29,0.06)",
            }}
          />
          <Area type="monotone" dataKey="count" stroke="#aa1945" strokeWidth={2.2} fill="url(#signupFill)" name="Signups" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgeBarChart({ data }: { data: NamedCount[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ece7e6" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b6166" }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b6166" }} tickLine={false} axisLine={false} width={28} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #ece7e6",
            }}
          />
          <Bar dataKey="value" name="Profiles" radius={[8, 8, 0, 0]} fill="#aa1945" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GenderPieChart({ data }: { data: NamedCount[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #ece7e6",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CountryBarChart({ data }: { data: NamedCount[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ece7e6" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#6b6166" }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 11, fill: "#6b6166" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #ece7e6",
            }}
          />
          <Bar dataKey="value" name="Profiles" radius={[0, 8, 8, 0]} fill="#b62a60" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
