import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

type Params = { token?: string };

export default function ShortPRoute() {
  const { token } = useParams<Params>();
  const navigate = useNavigate();

  useEffect(() => {
    // If there’s no token, go home.
    if (!token || token.trim().length === 0) {
      navigate("/", { replace: true });
      return;
    }
    // Forward to your canonical path (keeps one source of truth).
    // Use encodeURIComponent in case future tokens include reserved chars.
    navigate(`/stream/p/${encodeURIComponent(token)}`, { replace: true });
  }, [token, navigate]);

  return null; // No UI; this is a pure redirect.
}
