import { useEffect, useState } from "react";

export function useClientReady() {
  const [isReady, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return isReady;
}
