type Method = "easyApply" | "manuallyApplied";

export function ApplicationMethodIcon({ method }: { method: Method }) {
  const label = method === "easyApply" ? "Easy apply" : "Manually applied";
  return <span className={`method-icon method-icon-${method}`} role="img" aria-label={label} title={label}/>;
}

export function ApplicationMethodBreakdown({ counts, total, unavailable }: {
  counts: Record<Method, number>;
  total: number;
  unavailable: boolean;
}) {
  return <div className="method-breakdown">
    <div><ApplicationMethodIcon method="easyApply"/><span>Easy apply</span><span className="method-portion">{unavailable ? "—" : <><strong>{counts.easyApply}</strong> of {total}</>}</span></div>
    <div><ApplicationMethodIcon method="manuallyApplied"/><span>Manually applied</span><span className="method-portion">{unavailable ? "—" : <><strong>{counts.manuallyApplied}</strong> of {total}</>}</span></div>
  </div>;
}
