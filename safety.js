(() => {
  "use strict";

  function isLoopbackUrl(value) {
    try {
      const url = new URL(value);
      const hostname = url.hostname.toLowerCase();
      const allowedHost = hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "[::1]";
      return (url.protocol === "http:" || url.protocol === "https:") && allowedHost && !url.username && !url.password;
    } catch {
      return false;
    }
  }

  function isSafeDisplayPath(value) {
    return typeof value === "string" && value.trim().length > 0 && !value.includes("..") && !/[\u0000-\u001f]/.test(value);
  }

  const api = Object.freeze({ isLoopbackUrl, isSafeDisplayPath });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.DevSightSafety = api;
})();
