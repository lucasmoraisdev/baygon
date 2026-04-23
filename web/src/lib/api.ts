const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function fetchAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
  let token = null;
  if (typeof window !== "undefined") {
    token = localStorage.getItem("auth_token");
  }

  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Se receber 401 e temos refresh token, tentar renovar
  if (response.status === 401 && typeof window !== "undefined") {
    const refreshToken = localStorage.getItem("refresh_token");
    console.debug("fetchAPI: 401 recebido para", endpoint, "refreshToken presente:", Boolean(refreshToken));
    if (refreshToken && endpoint !== "/login" && endpoint !== "/refresh") {
      try {
        console.debug("fetchAPI: tentando refresh /refresh");
        const refreshResponse = await fetch(`${API_URL}/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          const newAccessToken = refreshData.access_token;
          // Sempre exigir um novo refresh token do servidor
          if (!refreshData.refresh_token) {
            throw new Error("Backend não retornou novo refresh token");
          }
          const newRefreshToken = refreshData.refresh_token;

          localStorage.setItem("auth_token", newAccessToken);
          localStorage.setItem("refresh_token", newRefreshToken);

          console.debug("fetchAPI: token renovado, refazendo requisição para", endpoint);
          headers.set("Authorization", `Bearer ${newAccessToken}`);
          const retryResponse = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
          });

          if (retryResponse.ok) {
            if (retryResponse.status === 204) {
              return null;
            }
            return retryResponse.json();
          }

          const retryError = await retryResponse.json().catch(() => ({}));
          throw new Error(retryError.detail || "Requisição falhou após renovar o token.");
        }

        const refreshError = await refreshResponse.json().catch(() => ({}));
        const refreshErrorMessage = refreshError.detail || "Falha ao renovar token.";

        // Se o refresh token também expirou, redirecionar
        if (refreshErrorMessage.includes("Refresh token expirado") || refreshErrorMessage.includes("Refresh token inválido")) {
          console.debug("fetchAPI: refresh token expirado, redirecionando para login");
          localStorage.removeItem("auth_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
          throw new Error("Sessão expirada. Faça login novamente.");
        }

        throw new Error(refreshErrorMessage);
      } catch (error: any) {
        console.error("fetchAPI: erro ao renovar token:", error);
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        throw new Error("Sessão expirada. Faça login novamente.");
      }
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errorMessage = errorBody.detail || "Request failed";

    // Se o erro for de token expirado, limpar tokens e redirecionar
    if (errorMessage.includes("Token expirado") || errorMessage.includes("Refresh token expirado")) {
      console.debug("fetchAPI: token expirado detectado, limpando sessão");
      localStorage.removeItem("auth_token");
      localStorage.removeItem("refresh_token");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
