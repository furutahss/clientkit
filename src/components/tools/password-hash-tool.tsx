"use client";

import * as React from "react";
import { Check, Copy, Eye, EyeOff, Loader2, RefreshCw, RotateCcw, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/use-locale";
import {
  ARGON2_VARIANTS,
  BCRYPT_MAX_PASSWORD_BYTES,
  BCRYPT_SALT_BYTES,
  clampParam,
  decodeSalt,
  DEFAULT_ARGON2_PARAMS,
  DEFAULT_BCRYPT_PARAMS,
  DEFAULT_PBKDF2_PARAMS,
  DEFAULT_SCRYPT_PARAMS,
  PARAM_LIMITS,
  parsePasswordHash,
  PASSWORD_HASH_ALGORITHMS,
  PasswordHashError,
  PBKDF2_HASHES,
  randomSaltHex,
  scryptMemoryBytes,
  type Argon2Params,
  type BcryptParams,
  type PasswordHashAlgorithm,
  type PasswordHashErrorCode,
  type PasswordHashInput,
  type PasswordHashResult,
  type Pbkdf2Params,
  type SaltEncoding,
  type ScryptParams,
} from "@/lib/password-hash";
import { formatBytes } from "@/lib/format-bytes";
import { cn, formatTemplate } from "@/lib/utils";
import { WorkerCancelledError, WorkerClient, WorkerTaskError } from "@/lib/worker-client";

type Tab = "generate" | "verify";
type ToolDict = Dictionary["tools"]["passwordHash"];

const ALGORITHM_LABELS: Record<PasswordHashAlgorithm, string> = {
  argon2: "Argon2",
  bcrypt: "bcrypt",
  scrypt: "scrypt",
  pbkdf2: "PBKDF2",
};

function createWorker() {
  return new Worker(new URL("../../lib/password-hash.worker.ts", import.meta.url), { type: "module" });
}

function errorMessage(dict: ToolDict, error: unknown): string {
  const code = error instanceof WorkerTaskError || error instanceof PasswordHashError ? error.code : null;
  const messages: Record<PasswordHashErrorCode, string> = dict.errors;
  return code && code in messages ? messages[code as PasswordHashErrorCode] : dict.errors.failed;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="inline-flex w-fit flex-wrap rounded-md border p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  limit,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  limit: { min: number; max: number };
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={limit.min}
          max={limit.max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onBlur={() => onChange(clampParam(value, limit))}
          className="h-7 w-32 text-right tabular-nums"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  dict,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  dict: ToolDict;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={dict.passwordPlaceholder}
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? dict.hidePassword : dict.showPassword}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function ResultRow({ label, value, dict }: { label: string; value: string; dict: ToolDict }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードAPIが利用できない環境では何もしない
    }
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={handleCopy}
          aria-label={formatTemplate(dict.copyAria, { label })}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
      <p className="font-mono text-sm break-all">{value}</p>
    </div>
  );
}

function useWorkerClient() {
  const clientRef = React.useRef<WorkerClient | null>(null);
  React.useEffect(() => () => clientRef.current?.cancel(), []);
  return React.useCallback(() => (clientRef.current ??= new WorkerClient(createWorker)), []);
}

function GeneratePanel({ dict }: { dict: ToolDict }) {
  const getClient = useWorkerClient();
  const [algorithm, setAlgorithm] = React.useState<PasswordHashAlgorithm>("argon2");
  const [password, setPassword] = React.useState("");
  const [salt, setSalt] = React.useState("");
  const [saltEncoding, setSaltEncoding] = React.useState<SaltEncoding>("hex");
  const [argon2, setArgon2] = React.useState<Argon2Params>(DEFAULT_ARGON2_PARAMS);
  const [bcrypt, setBcrypt] = React.useState<BcryptParams>(DEFAULT_BCRYPT_PARAMS);
  const [scrypt, setScrypt] = React.useState<ScryptParams>(DEFAULT_SCRYPT_PARAMS);
  const [pbkdf2, setPbkdf2] = React.useState<Pbkdf2Params>(DEFAULT_PBKDF2_PARAMS);
  const [result, setResult] = React.useState<PasswordHashResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // 乱数を含むためサーバー側では生成せず、ブラウザでのみ生成する
  React.useEffect(() => {
    Promise.resolve().then(() => setSalt(randomSaltHex()));
  }, []);

  function regenerateSalt() {
    setSalt(randomSaltHex());
    setSaltEncoding("hex");
  }

  function resetParams() {
    if (algorithm === "argon2") setArgon2(DEFAULT_ARGON2_PARAMS);
    else if (algorithm === "bcrypt") setBcrypt(DEFAULT_BCRYPT_PARAMS);
    else if (algorithm === "scrypt") setScrypt(DEFAULT_SCRYPT_PARAMS);
    else setPbkdf2(DEFAULT_PBKDF2_PARAMS);
  }

  function buildInput(): PasswordHashInput {
    const length = (value: number) => clampParam(value, PARAM_LIMITS.hashLength);
    switch (algorithm) {
      case "argon2":
        return {
          algorithm,
          params: {
            variant: argon2.variant,
            memorySize: clampParam(argon2.memorySize, PARAM_LIMITS.argon2MemorySize),
            iterations: clampParam(argon2.iterations, PARAM_LIMITS.argon2Iterations),
            parallelism: clampParam(argon2.parallelism, PARAM_LIMITS.argon2Parallelism),
            hashLength: length(argon2.hashLength),
          },
        };
      case "bcrypt":
        return { algorithm, params: { cost: clampParam(bcrypt.cost, PARAM_LIMITS.bcryptCost) } };
      case "scrypt":
        return {
          algorithm,
          params: {
            logN: clampParam(scrypt.logN, PARAM_LIMITS.scryptLogN),
            blockSize: clampParam(scrypt.blockSize, PARAM_LIMITS.scryptBlockSize),
            parallelism: clampParam(scrypt.parallelism, PARAM_LIMITS.scryptParallelism),
            hashLength: length(scrypt.hashLength),
          },
        };
      case "pbkdf2":
        return {
          algorithm,
          params: {
            hash: pbkdf2.hash,
            iterations: clampParam(pbkdf2.iterations, PARAM_LIMITS.pbkdf2Iterations),
            hashLength: length(pbkdf2.hashLength),
          },
        };
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    let saltBytes: Uint8Array;
    try {
      saltBytes = decodeSalt(salt, algorithm === "bcrypt" ? "hex" : saltEncoding);
    } catch (err) {
      setError(errorMessage(dict, err));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await getClient().request<PasswordHashResult>({
        type: "hash",
        password,
        salt: saltBytes,
        input: buildInput(),
      });
      setResult(next);
    } catch (err) {
      if (!(err instanceof WorkerCancelledError)) {
        setResult(null);
        setError(errorMessage(dict, err));
      }
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    getClient().cancel();
    setBusy(false);
  }

  const passwordBytes = new TextEncoder().encode(password).length;
  const scryptMemory = scryptMemoryBytes({
    ...scrypt,
    logN: clampParam(scrypt.logN, PARAM_LIMITS.scryptLogN),
    blockSize: clampParam(scrypt.blockSize, PARAM_LIMITS.scryptBlockSize),
  });

  return (
    <form onSubmit={handleGenerate} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{dict.algorithmLabel}</span>
          <Segmented
            value={algorithm}
            label={dict.algorithmLabel}
            options={PASSWORD_HASH_ALGORITHMS.map((value) => ({ value, label: ALGORITHM_LABELS[value] }))}
            onChange={(value) => {
              setAlgorithm(value);
              setResult(null);
              setError(null);
            }}
          />
          <p className="text-xs text-muted-foreground">{dict.algorithmHints[algorithm]}</p>
        </div>

        <PasswordField id="hash-password" label={dict.passwordLabel} value={password} onChange={setPassword} dict={dict} />
        {algorithm === "bcrypt" && passwordBytes > BCRYPT_MAX_PASSWORD_BYTES && (
          <p className="text-sm text-destructive">{dict.errors.bcryptPasswordTooLong}</p>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="hash-salt" className="text-sm font-medium">
              {dict.saltLabel}
            </label>
            {algorithm !== "bcrypt" && (
              <Segmented
                value={saltEncoding}
                label={dict.saltEncodingLabel}
                options={[
                  { value: "hex", label: dict.saltHex },
                  { value: "text", label: dict.saltText },
                ]}
                onChange={setSaltEncoding}
              />
            )}
          </div>
          <div className="flex gap-2">
            <Input
              id="hash-salt"
              value={salt}
              onChange={(e) => setSalt(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="font-mono text-sm"
            />
            <Button type="button" variant="outline" size="icon" onClick={regenerateSalt} aria-label={dict.randomSalt}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {algorithm === "bcrypt"
              ? formatTemplate(dict.saltHintBcrypt, { bytes: BCRYPT_SALT_BYTES })
              : dict.saltHint}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{dict.paramsLabel}</span>
            <Button type="button" variant="ghost" size="sm" onClick={resetParams}>
              <RotateCcw className="size-4" />
              {dict.resetParams}
            </Button>
          </div>

          {algorithm === "argon2" && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{dict.variantLabel}</span>
                <Segmented
                  value={argon2.variant}
                  label={dict.variantLabel}
                  options={ARGON2_VARIANTS.map((value) => ({
                    value,
                    label: value.replace("argon2", "Argon2"),
                  }))}
                  onChange={(variant) => setArgon2((prev) => ({ ...prev, variant }))}
                />
              </div>
              <NumberField
                id="argon2-memory"
                label={dict.memoryLabel}
                value={argon2.memorySize}
                limit={PARAM_LIMITS.argon2MemorySize}
                onChange={(memorySize) => setArgon2((prev) => ({ ...prev, memorySize }))}
                hint={formatTemplate(dict.memoryHint, {
                  size: formatBytes(clampParam(argon2.memorySize, PARAM_LIMITS.argon2MemorySize) * 1024),
                })}
              />
              <NumberField
                id="argon2-iterations"
                label={dict.iterationsLabel}
                value={argon2.iterations}
                limit={PARAM_LIMITS.argon2Iterations}
                onChange={(iterations) => setArgon2((prev) => ({ ...prev, iterations }))}
              />
              <NumberField
                id="argon2-parallelism"
                label={dict.parallelismLabel}
                value={argon2.parallelism}
                limit={PARAM_LIMITS.argon2Parallelism}
                onChange={(parallelism) => setArgon2((prev) => ({ ...prev, parallelism }))}
              />
              <NumberField
                id="argon2-length"
                label={dict.hashLengthLabel}
                value={argon2.hashLength}
                limit={PARAM_LIMITS.hashLength}
                onChange={(hashLength) => setArgon2((prev) => ({ ...prev, hashLength }))}
              />
            </>
          )}

          {algorithm === "bcrypt" && (
            <NumberField
              id="bcrypt-cost"
              label={dict.costLabel}
              value={bcrypt.cost}
              limit={PARAM_LIMITS.bcryptCost}
              onChange={(cost) => setBcrypt({ cost })}
              hint={formatTemplate(dict.costHint, {
                rounds: (2 ** clampParam(bcrypt.cost, PARAM_LIMITS.bcryptCost)).toLocaleString(),
              })}
            />
          )}

          {algorithm === "scrypt" && (
            <>
              <NumberField
                id="scrypt-logn"
                label={dict.logNLabel}
                value={scrypt.logN}
                limit={PARAM_LIMITS.scryptLogN}
                onChange={(logN) => setScrypt((prev) => ({ ...prev, logN }))}
                hint={formatTemplate(dict.logNHint, {
                  n: (2 ** clampParam(scrypt.logN, PARAM_LIMITS.scryptLogN)).toLocaleString(),
                  size: formatBytes(scryptMemory),
                })}
              />
              <NumberField
                id="scrypt-r"
                label={dict.blockSizeLabel}
                value={scrypt.blockSize}
                limit={PARAM_LIMITS.scryptBlockSize}
                onChange={(blockSize) => setScrypt((prev) => ({ ...prev, blockSize }))}
              />
              <NumberField
                id="scrypt-p"
                label={dict.parallelismLabel}
                value={scrypt.parallelism}
                limit={PARAM_LIMITS.scryptParallelism}
                onChange={(parallelism) => setScrypt((prev) => ({ ...prev, parallelism }))}
              />
              <NumberField
                id="scrypt-length"
                label={dict.hashLengthLabel}
                value={scrypt.hashLength}
                limit={PARAM_LIMITS.hashLength}
                onChange={(hashLength) => setScrypt((prev) => ({ ...prev, hashLength }))}
              />
            </>
          )}

          {algorithm === "pbkdf2" && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{dict.prfLabel}</span>
                <Segmented
                  value={pbkdf2.hash}
                  label={dict.prfLabel}
                  options={PBKDF2_HASHES.map((value) => ({ value, label: `HMAC-${value}` }))}
                  onChange={(hash) => setPbkdf2((prev) => ({ ...prev, hash }))}
                />
              </div>
              <NumberField
                id="pbkdf2-iterations"
                label={dict.iterationsLabel}
                value={pbkdf2.iterations}
                limit={PARAM_LIMITS.pbkdf2Iterations}
                onChange={(iterations) => setPbkdf2((prev) => ({ ...prev, iterations }))}
              />
              <NumberField
                id="pbkdf2-length"
                label={dict.hashLengthLabel}
                value={pbkdf2.hashLength}
                limit={PARAM_LIMITS.hashLength}
                onChange={(hashLength) => setPbkdf2((prev) => ({ ...prev, hashLength }))}
              />
            </>
          )}
          <p className="text-xs text-muted-foreground">{dict.defaultsNote}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {busy ? dict.generating : dict.generate}
          </Button>
          {busy && (
            <Button type="button" variant="outline" onClick={handleCancel}>
              <X className="size-4" />
              {dict.cancel}
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result ? (
          <div className="flex flex-col gap-2">
            {result.encoded && <ResultRow label={dict.encodedLabel} value={result.encoded} dict={dict} />}
            {result.hex && <ResultRow label={dict.hexLabel} value={result.hex} dict={dict} />}
            {result.base64 && <ResultRow label={dict.base64Label} value={result.base64} dict={dict} />}
            <ResultRow label={dict.saltHexLabel} value={result.saltHex} dict={dict} />
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatTemplate(dict.elapsed, { ms: Math.round(result.elapsedMs).toLocaleString() })}
            </p>
            {!result.encoded && <p className="text-xs text-muted-foreground">{dict.noEncodedNote}</p>}
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {dict.resultPlaceholder}
          </p>
        )}
      </div>
    </form>
  );
}

function VerifyPanel({ dict }: { dict: ToolDict }) {
  const getClient = useWorkerClient();
  const [hash, setHash] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [verdict, setVerdict] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const parsed = hash.trim() ? parsePasswordHash(hash) : null;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setVerdict(null);
    try {
      setVerdict(await getClient().request<boolean>({ type: "verify", password, hash }));
    } catch (err) {
      if (!(err instanceof WorkerCancelledError)) setError(errorMessage(dict, err));
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    getClient().cancel();
    setBusy(false);
  }

  let detected: string | null = null;
  if (parsed?.algorithm === "argon2") {
    detected = formatTemplate(dict.detectedArgon2, {
      variant: parsed.variant.replace("argon2", "Argon2"),
      memory: formatBytes(parsed.memorySize * 1024),
      t: parsed.iterations,
      p: parsed.parallelism,
    });
  } else if (parsed?.algorithm === "bcrypt") {
    detected = formatTemplate(dict.detectedBcrypt, { cost: parsed.cost });
  }

  return (
    <form onSubmit={handleVerify} className="flex max-w-3xl flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="verify-hash" className="text-sm font-medium">
          {dict.verifyHashLabel}
        </label>
        <Textarea
          id="verify-hash"
          value={hash}
          onChange={(e) => {
            setHash(e.target.value);
            setVerdict(null);
          }}
          placeholder={dict.verifyHashPlaceholder}
          spellCheck={false}
          className="min-h-20 font-mono text-sm"
        />
        <p className={cn("text-xs", hash.trim() && !parsed ? "text-destructive" : "text-muted-foreground")}>
          {detected ?? (hash.trim() ? dict.errors.unsupportedFormat : dict.verifyHashHint)}
        </p>
      </div>
      <PasswordField
        id="verify-password"
        label={dict.passwordLabel}
        value={password}
        onChange={(value) => {
          setPassword(value);
          setVerdict(null);
        }}
        dict={dict}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy || !parsed}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {busy ? dict.verifying : dict.verify}
        </Button>
        {busy && (
          <Button type="button" variant="outline" onClick={handleCancel}>
            <X className="size-4" />
            {dict.cancel}
          </Button>
        )}
        {verdict !== null && (
          <span
            role="status"
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium",
              verdict
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {verdict ? dict.verifyMatch : dict.verifyMismatch}
          </span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}

export function PasswordHashTool() {
  const locale = useLocale();
  const dict = getDictionary(locale).tools.passwordHash;
  const [tab, setTab] = React.useState<Tab>("generate");

  const TABS: { value: Tab; label: string }[] = [
    { value: "generate", label: dict.tabGenerate },
    { value: "verify", label: dict.tabVerify },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{dict.safetyNote}</span>
      </div>

      <div className="inline-flex w-fit rounded-md border p-1">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              tab === item.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* タブを切り替えても入力内容が消えないよう、非表示にするだけにする */}
      <div hidden={tab !== "generate"}>
        <GeneratePanel dict={dict} />
      </div>
      <div hidden={tab !== "verify"}>
        <VerifyPanel dict={dict} />
      </div>
    </div>
  );
}
