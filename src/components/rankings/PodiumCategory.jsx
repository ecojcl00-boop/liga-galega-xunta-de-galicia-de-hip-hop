import React from "react";

const podiumHeights = { 1: "h-24", 2: "h-16", 3: "h-12" };
const podiumBg = {
  1: "bg-yellow-400",
  2: "bg-gray-300",
  3: "bg-amber-500",
};
const figureColors = {
  1: "text-yellow-500",
  2: "text-gray-400",
  3: "text-amber-600",
};

function Stickman({ color = "text-primary", size = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 24 40" className={`${size} ${color}`} fill="currentColor">
      {/* head */}
      <circle cx="12" cy="5" r="4" />
      {/* body */}
      <line x1="12" y1="9" x2="12" y2="25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {/* arms */}
      <line x1="4" y1="16" x2="20" y2="16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {/* legs */}
      <line x1="12" y1="25" x2="5" y2="38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="25" x2="19" y2="38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
const podiumOrder = [2, 1, 3]; // left to right display order

export default function PodiumCategory({ results, category }) {
  const sorted = [...results].sort((a, b) => a.position - b.position);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  // Map position to item
  const byPos = {};
  top3.forEach(r => { byPos[r.position] = r; });

  return (
    <div className="space-y-4">
      {/* Podium */}
      <div className="flex items-end justify-center gap-3 pt-4">
        {podiumOrder.map(pos => {
          const r = byPos[pos];
          if (!r) return <div key={pos} className="w-24" />;
          return (
            <div key={pos} className="flex flex-col items-center gap-1 w-28">
              {/* Stickman + medal */}
              <div className="flex flex-col items-center">
                <span className="text-xl mb-0.5">{medals[pos]}</span>
                <Stickman color={figureColors[pos]} size={pos === 1 ? "w-10 h-10" : "w-7 h-7"} />
              </div>
              {/* Name */}
              <div className="text-center">
                <p className={`font-bold text-xs leading-tight ${pos === 1 ? "text-sm" : "text-xs"}`} style={{ wordBreak: "break-word" }}>{r.group_name}</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-full">{r.school_name}</p>
                <p className={`font-black ${pos === 1 ? "text-base text-yellow-500" : pos === 2 ? "text-sm text-gray-400" : "text-sm text-amber-600"}`}>{r.score}</p>
              </div>
              {/* Podium block */}
              <div className={`w-full ${podiumHeights[pos]} ${podiumBg[pos]} rounded-t-lg flex items-center justify-center`}>
                <span className="text-white font-black text-lg">{pos}º</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rest of positions */}
      {rest.length > 0 && (
        <div className="space-y-1 pt-1">
          {rest.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 text-sm">
              <span className="text-muted-foreground font-bold w-6 text-center">{r.position}º</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.group_name}</p>
                <p className="text-xs text-muted-foreground truncate">{r.school_name}</p>
              </div>
              <span className="font-bold text-muted-foreground">{r.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}