"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Image from "next/image";
import { Copy, Check, Trash2, ChevronRight, BarChart3, Settings, X } from "lucide-react";
import { calculatePMT } from "@/lib/pmt";
import {
  formatCurrency,
  parseCurrencyInput,
  formatCurrencyInput,
} from "@/lib/currency";

const PARCELA_SHORTCUTS = [4, 6, 9, 12, 18, 24] as const;
const DEFAULT_RATE = 0.035;
const STORAGE_KEY = "simulador-rates";

type RateMap = Record<number, number>;

function loadRates(): RateMap {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function saveRates(rates: RateMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rates));
}

export default function SimuladorPage() {
  const [valorReformaRaw, setValorReformaRaw] = useState("");
  const [entradaPrevistaRaw, setEntradaPrevistaRaw] = useState("");
  const [parcelasRaw, setParcelasRaw] = useState("");
  const [copied, setCopied] = useState(false);
  const [rateMap, setRateMap] = useState<RateMap>({});
  const [showSettings, setShowSettings] = useState(false);
  const [touched, setTouched] = useState({
    valorReforma: false,
    entradaPrevista: false,
    parcelas: false,
  });

  useEffect(() => {
    setRateMap(loadRates());
  }, []);

  const valorReforma = parseCurrencyInput(valorReformaRaw);
  const entradaPrevista = parseCurrencyInput(entradaPrevistaRaw);
  const parcelas = parseInt(parcelasRaw || "0", 10);
  const currentRate = rateMap[parcelas] ?? DEFAULT_RATE;

  const validation = useMemo(() => {
    const errors: Record<string, string | null> = {
      valorReforma: null,
      entradaPrevista: null,
      parcelas: null,
    };

    if (touched.valorReforma && valorReforma <= 0) {
      errors.valorReforma = "Informe o valor da reforma.";
    }

    if (touched.entradaPrevista && entradaPrevista < 0) {
      errors.entradaPrevista = "Informe uma entrada prevista válida.";
    }

    if (
      touched.entradaPrevista &&
      touched.valorReforma &&
      valorReforma > 0 &&
      entradaPrevista > valorReforma
    ) {
      errors.entradaPrevista =
        "A entrada prevista não pode ser maior que o valor da reforma.";
    }

    if (
      touched.entradaPrevista &&
      touched.valorReforma &&
      valorReforma > 0 &&
      entradaPrevista < valorReforma * 0.3
    ) {
      const minEntrada = valorReforma * 0.3;
      errors.entradaPrevista =
        `A entrada deve ser no mínimo 30% do valor da reforma (${formatCurrency(minEntrada)}).`;
    }

    if (touched.parcelas && (parcelas <= 0 || !Number.isInteger(parcelas))) {
      errors.parcelas = "Informe a quantidade de parcelas.";
    }

    return errors;
  }, [valorReforma, entradaPrevista, parcelas, touched]);

  const isValid =
    valorReforma > 0 &&
    entradaPrevista >= valorReforma * 0.3 &&
    entradaPrevista <= valorReforma &&
    parcelas > 0 &&
    Number.isInteger(parcelas);

  const valorParcela = isValid
    ? calculatePMT(valorReforma, entradaPrevista, parcelas, currentRate)
    : 0;

  const saldoFinanciado = isValid ? valorReforma - entradaPrevista : 0;

  const handleCurrencyChange = useCallback(
    (setter: (v: string) => void) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "");
        if (raw === "") {
          setter("");
          return;
        }
        const numeric = parseInt(raw, 10) / 100;
        setter(formatCurrencyInput(numeric));
      },
    []
  );

  const handleParcelasChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "");
      setParcelasRaw(raw);
      if (!touched.parcelas) {
        setTouched((prev) => ({ ...prev, parcelas: true }));
      }
    },
    [touched.parcelas]
  );

  const handleShortcut = useCallback((value: number) => {
    setParcelasRaw(String(value));
    setTouched((prev) => ({ ...prev, parcelas: true }));
  }, []);

  const handleClear = useCallback(() => {
    setValorReformaRaw("");
    setEntradaPrevistaRaw("");
    setParcelasRaw("");
    setCopied(false);
    setTouched({
      valorReforma: false,
      entradaPrevista: false,
      parcelas: false,
    });
  }, []);

  const whatsappText = useMemo(() => {
    if (!isValid) return "";
    return `Simulação da reforma:\nValor da reforma: ${formatCurrency(valorReforma)}\nEntrada prevista: ${formatCurrency(entradaPrevista)}\nParcelamento: ${parcelas}x de ${formatCurrency(valorParcela)}\n\nSimulação estimada.`;
  }, [isValid, valorReforma, entradaPrevista, parcelas, valorParcela]);

  const handleCopy = useCallback(async () => {
    if (!whatsappText) return;
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = whatsappText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [whatsappText]);

  const handleRateChange = useCallback((parcelaCount: number, ratePercent: string) => {
    const parsed = parseFloat(ratePercent.replace(",", "."));
    if (isNaN(parsed)) return;
    setRateMap((prev) => {
      const next = { ...prev, [parcelaCount]: parsed / 100 };
      saveRates(next);
      return next;
    });
  }, []);

  const handleBlur = useCallback(
    (field: keyof typeof touched) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
    },
    []
  );

  // Format the parcela value for the large display
  const parcelaFormatted = useMemo(() => {
    if (!isValid) return { integer: "0", decimal: "00" };
    const parts = valorParcela.toFixed(2).split(".");
    const integer = parseInt(parts[0], 10).toLocaleString("pt-BR");
    return { integer, decimal: parts[1] };
  }, [isValid, valorParcela]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg-page)" }}>
      {/* Header */}
      <header
        className="w-full px-4 py-4 md:px-8"
        style={{ background: "var(--color-primary)" }}
      >
        <div className="mx-auto max-w-[1120px] flex items-center">
          <Image
            src="/logo-decorafit.png"
            alt="Decorafit"
            width={384}
            height={31}
            className="h-7 w-auto sm:h-8"
            priority
          />
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="ml-auto p-2 rounded-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.6)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.6)";
            }}
            aria-label="Configurações de taxas"
          >
            <Settings size={20} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-8 md:px-8 lg:py-12 lg:flex lg:items-center">
        <div className="mx-auto w-full max-w-[1120px]">
          {/* Title */}
          <div className="mb-8">
            <h1
              className="text-2xl font-bold lg:text-4xl"
              style={{ color: "var(--color-dark)" }}
            >
              Simulador de{" "}
              <span style={{ color: "var(--color-primary)" }}>Parcelas</span>
            </h1>
            <p
              className="mt-2 text-sm lg:text-base"
              style={{ color: "var(--color-dark-muted)" }}
            >
              Preencha os dados abaixo para estimar o valor das parcelas da
              reforma.
            </p>
          </div>

          {/* Two-column layout */}
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* Left: Form card */}
            <div
              className="rounded-2xl border p-6 lg:px-8 lg:py-10"
              style={{
                backgroundColor: "var(--color-bg)",
                borderColor: "var(--color-border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* Card header */}
              <div className="mb-6 flex items-center gap-2">
                <BarChart3
                  size={20}
                  strokeWidth={1.5}
                  style={{ color: "var(--color-dark)" }}
                />
                <h2
                  className="text-base font-bold"
                  style={{ color: "var(--color-dark)" }}
                >
                  Dados da Simulação
                </h2>
              </div>

              {/* Valor + Entrada side by side */}
              <div className="grid gap-5 sm:grid-cols-2">
                {/* Valor da reforma */}
                <div>
                  <label
                    htmlFor="valor-reforma"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--color-dark-muted)" }}
                  >
                    Valor da reforma
                  </label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
                      style={{ color: "var(--color-dark-subtle)" }}
                    >
                      R$
                    </span>
                    <input
                      id="valor-reforma"
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={valorReformaRaw}
                      onChange={handleCurrencyChange(setValorReformaRaw)}
                      onBlur={handleBlur("valorReforma")}
                      className="h-12 w-full rounded-lg border bg-white pl-10 pr-4 text-base font-medium transition-colors lg:h-11 lg:text-sm"
                      style={{
                        borderColor: validation.valorReforma
                          ? "var(--color-error)"
                          : "var(--color-border)",
                        color: "var(--color-dark)",
                      }}
                    />
                  </div>
                  {validation.valorReforma && (
                    <p
                      className="mt-1 text-xs"
                      style={{ color: "var(--color-error)" }}
                    >
                      {validation.valorReforma}
                    </p>
                  )}
                </div>

                {/* Entrada prevista */}
                <div>
                  <label
                    htmlFor="entrada-prevista"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--color-dark-muted)" }}
                  >
                    Entrada prevista
                  </label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
                      style={{ color: "var(--color-dark-subtle)" }}
                    >
                      R$
                    </span>
                    <input
                      id="entrada-prevista"
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={entradaPrevistaRaw}
                      onChange={handleCurrencyChange(setEntradaPrevistaRaw)}
                      onBlur={handleBlur("entradaPrevista")}
                      className="h-12 w-full rounded-lg border bg-white pl-10 pr-4 text-base font-medium transition-colors lg:h-11 lg:text-sm"
                      style={{
                        borderColor: validation.entradaPrevista
                          ? "var(--color-error)"
                          : "var(--color-border)",
                        color: "var(--color-dark)",
                      }}
                    />
                  </div>
                  {validation.entradaPrevista && (
                    <p
                      className="mt-1 text-xs"
                      style={{ color: "var(--color-error)" }}
                    >
                      {validation.entradaPrevista}
                    </p>
                  )}
                </div>
              </div>

              {/* Prazo para pagamento */}
              <div className="mt-6">
                <label
                  htmlFor="parcelas"
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--color-dark-muted)" }}
                >
                  Prazo para pagamento
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <input
                      id="parcelas"
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={parcelasRaw}
                      onChange={handleParcelasChange}
                      onBlur={handleBlur("parcelas")}
                      className="h-12 w-24 rounded-lg border bg-white px-3 pr-16 text-base font-medium transition-colors lg:h-11 lg:text-sm"
                      style={{
                        borderColor: validation.parcelas
                          ? "var(--color-error)"
                          : "var(--color-border)",
                        color: "var(--color-dark)",
                      }}
                    />
                    <span
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
                      style={{ color: "var(--color-dark-subtle)" }}
                    >
                      Meses
                    </span>
                  </div>
                  {/* Shortcut pills */}
                  <div className="flex flex-wrap gap-2">
                    {PARCELA_SHORTCUTS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleShortcut(n)}
                        className="flex h-9 items-center justify-center rounded-full px-4 text-xs font-semibold transition-all"
                        style={{
                          backgroundColor:
                            parcelas === n
                              ? "var(--color-primary)"
                              : "var(--color-bg)",
                          color:
                            parcelas === n
                              ? "#FFFFFF"
                              : "var(--color-dark-muted)",
                          border:
                            parcelas === n
                              ? "1px solid var(--color-primary)"
                              : "1px solid var(--color-border)",
                        }}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>
                {validation.parcelas && (
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--color-error)" }}
                  >
                    {validation.parcelas}
                  </p>
                )}
              </div>

              {/* Bottom row: clear + note */}
              <div className="mt-6 flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                  style={{ color: "var(--color-dark-muted)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--color-dark)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--color-dark-muted)";
                  }}
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                  LIMPAR SIMULAÇÃO
                </button>
                <span
                  className="text-[11px]"
                  style={{ color: "var(--color-dark-subtle)" }}
                >
                  Simulação estimada.
                </span>
              </div>
            </div>

            {/* Right: Dark result card */}
            <div
              className="rounded-2xl flex flex-col overflow-hidden lg:self-center"
              style={{
                background: "linear-gradient(180deg, #2A2A45 0%, #1B1B2F 100%)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              {/* Orange gradient bar at top */}
              <div
                className="h-1 w-full"
                style={{
                  background: "linear-gradient(90deg, #FF6633 0%, #FFB347 100%)",
                }}
              />
              <div className="p-6 lg:p-8 flex flex-col">
              {/* Parcela estimada label */}
              <p
                className="text-[11px] font-semibold uppercase tracking-widest text-center mb-4"
                style={{ color: "var(--color-primary)" }}
              >
                Parcela
              </p>

              {/* Large value */}
              <div className="text-center mb-6">
                {isValid ? (
                  <p className="text-white">
                    <span className="text-lg font-semibold align-top">R$</span>
                    <span className="text-5xl font-bold mx-1 leading-none">
                      {parcelaFormatted.integer}
                    </span>
                    <span className="text-lg font-semibold align-top">
                      ,{parcelaFormatted.decimal}
                    </span>
                  </p>
                ) : (
                  <p className="text-white/40 text-sm">
                    Preencha os campos para visualizar a simulação.
                  </p>
                )}
              </div>

              {/* Divider */}
              <div
                className="h-px w-full mb-5"
                style={{ background: "rgba(255,255,255,0.1)" }}
              />

              {/* Details rows */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Entrada
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {isValid ? formatCurrency(entradaPrevista) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Saldo financiado
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {isValid ? formatCurrency(saldoFinanciado) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Total da reforma
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {isValid ? formatCurrency(valorReforma) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Prazo escolhido
                  </span>
                  <span className="text-sm font-bold italic text-white">
                    {isValid ? `${parcelas} Meses` : "—"}
                  </span>
                </div>
              </div>

              {/* CTA Button */}
              <button
                type="button"
                disabled={!isValid}
                onClick={handleCopy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold text-white uppercase tracking-wider transition-all disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  backgroundColor: isValid
                    ? copied
                      ? "var(--color-success)"
                      : "var(--color-primary)"
                    : "var(--color-primary)",
                  boxShadow:
                    isValid && !copied ? "var(--shadow-orange)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (isValid && !copied)
                    e.currentTarget.style.backgroundColor =
                      "var(--color-primary-hover)";
                }}
                onMouseLeave={(e) => {
                  if (isValid && !copied)
                    e.currentTarget.style.backgroundColor =
                      "var(--color-primary)";
                }}
              >
                {copied ? (
                  <>
                    <Check size={18} strokeWidth={2} />
                    Copiado!
                  </>
                ) : (
                  <>
                    <ChevronRight size={18} strokeWidth={2} />
                    Copiar para WhatsApp
                  </>
                )}
              </button>

              </div>
            </div>
          </div>

          {/* Banner */}
          <div className="mt-8 overflow-hidden rounded-2xl">
            <Image
              src="/banner-simulador.png"
              alt="O apê que você sonha cabe no seu bolso."
              width={1120}
              height={200}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="w-full px-4 py-5 md:px-8 mt-auto"
        style={{ background: "var(--color-primary)" }}
      />

      {/* Settings Modal */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(27,27,47,0.6)" }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl relative overflow-hidden"
            style={{
              background: "linear-gradient(180deg, #2A2A45 0%, #1B1B2F 100%)",
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Orange gradient bar at top */}
            <div
              className="h-1 w-full"
              style={{
                background: "linear-gradient(90deg, #FF6633 0%, #FFB347 100%)",
              }}
            />

            <div className="p-6">
              {/* Close button */}
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="absolute top-5 right-4 p-1 rounded transition-colors"
                style={{ color: "rgba(255,255,255,0.5)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#FFFFFF";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                }}
              >
                <X size={18} strokeWidth={2} />
              </button>

              {/* Title */}
              <h3
                className="text-sm font-bold uppercase tracking-wider mb-1"
                style={{ color: "var(--color-primary)" }}
              >
                Configurações
              </h3>
              <p
                className="text-xs mb-6"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                Taxa de juros mensal por quantidade de parcelas
              </p>

              {/* Rate inputs */}
              <div className="space-y-3">
                {PARCELA_SHORTCUTS.map((n) => (
                  <div
                    key={n}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm font-semibold text-white w-16">
                      {n}x
                    </span>
                    <div className="relative flex-1 max-w-[140px]">
                      <input
                        type="text"
                        inputMode="decimal"
                        defaultValue={((rateMap[n] ?? DEFAULT_RATE) * 100)
                          .toFixed(1)
                          .replace(".", ",")}
                        onBlur={(e) => handleRateChange(n, e.target.value)}
                        className="h-10 w-full rounded-lg border bg-white/10 px-3 pr-8 text-sm font-medium text-white text-right"
                        style={{ borderColor: "rgba(255,255,255,0.15)" }}
                      />
                      <span
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                        style={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reset button */}
              <button
                type="button"
                onClick={() => {
                  setRateMap({});
                  localStorage.removeItem(STORAGE_KEY);
                  setShowSettings(false);
                }}
                className="mt-6 text-xs font-semibold uppercase tracking-wider transition-colors"
                style={{ color: "rgba(255,255,255,0.45)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--color-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.45)";
                }}
              >
                Restaurar padrão (3,5%)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
