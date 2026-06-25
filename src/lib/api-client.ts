export async function readApiJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    if (!response.ok) {
      throw new Error(`서버 오류 (${response.status})`);
    }
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 160);
    const lower = preview.toLowerCase();

    if (
      response.status === 504 ||
      lower.includes("timeout") ||
      lower.includes("timed out")
    ) {
      throw new Error(
        "요청 시간이 초과되었습니다. AI 생성에 시간이 걸릴 수 있으니 잠시 후 다시 시도해 주세요."
      );
    }

    if (lower.includes("an error occurred") || lower.includes("internal server error")) {
      throw new Error(
        "서버에서 오류가 발생했습니다. Vercel 배포 로그를 확인하거나 잠시 후 다시 시도해 주세요."
      );
    }

    throw new Error(
      preview || `서버가 JSON이 아닌 응답을 반환했습니다 (${response.status})`
    );
  }
}
