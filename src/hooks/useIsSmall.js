import { useEffect, useState } from "react";

export default function useIsSmall(breakpointPx = 768) {
  const [isSmall, setIsSmall] = useState(() => window.innerWidth < breakpointPx);
  useEffect(() => {
    const onResize = () => setIsSmall(window.innerWidth < breakpointPx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);
  return isSmall;
}
