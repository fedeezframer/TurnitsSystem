import * as React from "react";

export function useOverlayPresence(open: boolean) {
  const [visible, setVisible] = React.useState(open);
  const [closing, setClosing] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
      return;
    }
    if (!visible) return;
    setClosing(true);
    const timer = window.setTimeout(() => { setVisible(false); setClosing(false); }, 180);
    return () => window.clearTimeout(timer);
  }, [open, visible]);
  return { visible, closing };
}
