export function consumerHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("access_token");
    return token && localStorage.getItem("account_type") === "usuario"
      ? { Authorization: `Bearer ${token}` }
      : {};
  } catch {
    return {};
  }
}
