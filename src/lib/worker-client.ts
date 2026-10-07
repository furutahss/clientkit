/** Web Workerの処理を中断したときに、待機中の呼び出しへ返すエラー */
export class WorkerCancelledError extends Error {
  constructor() {
    super("cancelled");
  }
}

/** Workerからの失敗応答。error には Worker が返したエラーの種類が入る */
export class WorkerTaskError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  onProgress?: (progress: unknown) => void;
};

/**
 * Web Workerへのリクエストと応答を id で対応付けて Promise として扱うクライアント。
 * Worker 側は { id, ok: true, result } または { id, ok: false, error } を返すこと。
 * 途中経過は { id, progress } で送ると、request の onProgress に渡される。
 * cancel() は Worker を終了して待機中の呼び出しを中断し、次のリクエスト時に作り直す。
 */
export class WorkerClient {
  private worker: Worker | null = null;
  private nextId = 0;
  private pending = new Map<number, Pending>();

  constructor(private readonly create: () => Worker) {}

  request<T, P = never>(
    message: Record<string, unknown>,
    transfer: Transferable[] = [],
    onProgress?: (progress: P) => void
  ): Promise<T> {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        onProgress: onProgress as ((progress: unknown) => void) | undefined,
      });
      worker.postMessage({ ...message, id }, transfer);
    });
  }

  cancel(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const { reject } of this.pending.values()) reject(new WorkerCancelledError());
    this.pending.clear();
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = this.create();
    worker.onmessage = (event: MessageEvent<{ id: number; ok?: boolean; result?: unknown; error?: string; progress?: unknown }>) => {
      const { id, ok, result, error, progress } = event.data;
      const entry = this.pending.get(id);
      if (!entry) return;
      if (ok === undefined) {
        entry.onProgress?.(progress);
        return;
      }
      this.pending.delete(id);
      if (ok) entry.resolve(result);
      else entry.reject(new WorkerTaskError(error ?? "unknown"));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      for (const { reject } of this.pending.values()) reject(new WorkerTaskError("crashed"));
      this.pending.clear();
      worker.terminate();
      this.worker = null;
    };
    this.worker = worker;
    return worker;
  }
}
