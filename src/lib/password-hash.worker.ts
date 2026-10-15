/**
 * パスワードハッシュの生成・検証を行う Web Worker。
 * Argon2やscryptはパラメータ次第で数秒かかるため、画面が固まらないようメインスレッドから切り離して実行する。
 */
import {
  computePasswordHash,
  PasswordHashError,
  verifyPasswordHash,
  type PasswordHashInput,
} from "@/lib/password-hash";

export type PasswordHashWorkerRequest =
  | { type: "hash"; password: string; salt: Uint8Array; input: PasswordHashInput }
  | { type: "verify"; password: string; hash: string };

function post(message: unknown) {
  (self as unknown as Worker).postMessage(message);
}

self.onmessage = async (event: MessageEvent<PasswordHashWorkerRequest & { id: number }>) => {
  const { id, ...request } = event.data;
  try {
    const result =
      request.type === "hash"
        ? await computePasswordHash(request.password, request.salt, request.input)
        : await verifyPasswordHash(request.password, request.hash);
    post({ id, ok: true, result });
  } catch (e) {
    post({ id, ok: false, error: e instanceof PasswordHashError ? e.code : "failed" });
  }
};
