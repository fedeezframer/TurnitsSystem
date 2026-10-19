import * as React from "react";
import { useStartupLoading } from "./BrandPreloader";
import RunningCalendar from "./RunningCalendar";
import "./LoadingRunner.css";

const SectionLoadingContext = React.createContext<{
  register: (id: string) => () => void;
  initialComplete: boolean;
} | null>(null);

export function InlineLoading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="turnits-inline-loading" role="status">
      {label}
    </div>
  );
}

// Keep requests mounted while a section loads. Multiple pending blocks share
// one loader, which stays visible until the last block has finished.
export function SectionLoadingBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const pending = React.useRef(new Set<string>());
  const [count, setCount] = React.useState(0);
  const [initialComplete, setInitialComplete] = React.useState(false);
  useStartupLoading(!initialComplete);
  const register = React.useCallback((id: string) => {
    pending.current.add(id);
    setCount(pending.current.size);
    return () => {
      pending.current.delete(id);
      setCount(pending.current.size);
    };
  }, []);
  React.useLayoutEffect(() => {
    // Later edits and refreshes keep their existing content on screen.
    if (pending.current.size === 0) setInitialComplete(true);
  }, [count]);
  const context = React.useMemo(
    () => ({ register, initialComplete }),
    [register, initialComplete],
  );
  const loading = !initialComplete && count > 0;
  return (
    <div className="turnits-section-loading" aria-busy={loading}>
      {loading && (
        <SectionLoadingContext.Provider value={null}>
          <LoadingRunner card />
        </SectionLoadingContext.Provider>
      )}
      <div
        className="turnits-section-content"
        aria-hidden={loading || undefined}
      >
        <SectionLoadingContext.Provider value={context}>
          {children}
        </SectionLoadingContext.Provider>
      </div>
    </div>
  );
}

export default function LoadingRunner({
  label = "Cargando…",
  card = false,
}: {
  label?: string;
  size?: "section" | "compact" | "inline";
  card?: boolean;
}) {
  const instanceId = React.useId().replace(/:/g, "");
  const section = React.useContext(SectionLoadingContext);
  const register = section?.initialComplete ? undefined : section?.register;
  React.useLayoutEffect(() => register?.(instanceId), [register, instanceId]);
  if (section)
    return section.initialComplete ? <InlineLoading label={label} /> : null;
  return (
    <div
      className={["turnits-runner-loading", card ? "is-card" : ""]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-label={label}
    >
      <RunningCalendar />
      <span className="turnits-runner-description">Cargando</span>
    </div>
  );
}
