"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildTrackingUrl,
  listCarriers,
  resolveShippingMethod,
  sanitizeTrackingNumber,
  type CarrierId,
} from "@/lib/shipping/track";

const CARRIERS = listCarriers();

type ShipDialogProps = {
  orderId: string;
  triggerLabel?: string;
  defaultCarrier?: CarrierId;
  defaultTrackingNumber?: string | null;
  defaultTrackingUrl?: string | null;
  defaultShippingMethod?: string | null;
  onCompleted?: (result: {
    status: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippingMethod: string | null;
  }) => void;
};

export function ShipDialog({
  orderId,
  triggerLabel = "Mark as shipped",
  defaultCarrier,
  defaultTrackingNumber = "",
  defaultTrackingUrl = "",
  defaultShippingMethod = "",
  onCompleted,
}: ShipDialogProps) {
  const router = useRouter();
  const initialCarrier =
    CARRIERS.find((carrier) => carrier.id === defaultCarrier)?.id ?? CARRIERS[0]?.id ?? "other";

  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState<CarrierId>(initialCarrier as CarrierId);
  const [trackingNumber, setTrackingNumber] = useState(defaultTrackingNumber ?? "");
  const [trackingUrl, setTrackingUrl] = useState(defaultTrackingUrl ?? "");
  const [shippingMethod, setShippingMethod] = useState(
    defaultShippingMethod ?? resolveShippingMethod(initialCarrier as CarrierId, null),
  );
  const [shippingMethodTouched, setShippingMethodTouched] = useState(
    Boolean(defaultShippingMethod && defaultShippingMethod.trim().length > 0),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const carrierConfig = useMemo(
    () => CARRIERS.find((entry) => entry.id === carrier) ?? CARRIERS[0],
    [carrier],
  );

  const previewUrl = useMemo(() => {
    const sanitized = sanitizeTrackingNumber(trackingNumber);
    if (!sanitized) {
      return null;
    }

    return buildTrackingUrl(carrier, sanitized, {
      customUrl: carrierConfig.urlTemplate ? undefined : trackingUrl || undefined,
    });
  }, [carrier, trackingNumber, trackingUrl, carrierConfig.urlTemplate]);

  function closeDialog() {
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orders/${orderId}/ship`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          carrier,
          trackingNumber,
          shippingMethod,
          trackingUrl: carrierConfig.urlTemplate ? undefined : trackingUrl,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        order?: {
          status: string;
          trackingNumber: string | null;
          trackingUrl: string | null;
          shippingMethod: string | null;
        };
      };

      if (!response.ok) {
        setError(payload?.error ?? "Nie udało się oznaczyć przesyłki.");
        return;
      }

      onCompleted?.({
        status: payload.order?.status ?? "shipped",
        trackingNumber: payload.order?.trackingNumber ?? null,
        trackingUrl: payload.order?.trackingUrl ?? null,
        shippingMethod: payload.order?.shippingMethod ?? null,
      });

      setOpen(false);
      router.refresh();
    } catch (submissionError) {
      setError("Połączenie z serwerem nie powiodło się. Spróbuj ponownie.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" variant="default" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">Wysyłka zamówienia</h2>
              <button
                type="button"
                className="text-neutral-500 transition hover:text-neutral-800"
                onClick={closeDialog}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Przewoźnik</label>
                <select
                  value={carrier}
                  onChange={(event) => {
                    const nextCarrier = event.target.value as CarrierId;
                    setCarrier(nextCarrier);
                    const nextConfig =
                      CARRIERS.find((entry) => entry.id === nextCarrier) ?? carrierConfig;
                    if (nextConfig.urlTemplate) {
                      setTrackingUrl("");
                    }
                    if (!shippingMethodTouched) {
                      setShippingMethod(resolveShippingMethod(nextCarrier, null));
                    }
                  }}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
                  disabled={isSubmitting}
                >
                  {CARRIERS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Numer przesyłki
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(event) => setTrackingNumber(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
                  placeholder="np. 1234567890"
                  autoCapitalize="characters"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {carrierConfig.urlTemplate === null ? (
                <div>
                  <label className="block text-sm font-medium text-neutral-700">
                    Link do śledzenia
                  </label>
                  <input
                    type="url"
                    value={trackingUrl}
                    onChange={(event) => setTrackingUrl(event.target.value)}
                    className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
                    placeholder="https://"
                    required
                    disabled={isSubmitting}
                  />
                  <p className="mt-1 text-xs text-neutral-500">
                    Wymagane pełne HTTPS URL do strony przewoźnika.
                  </p>
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Metoda wysyłki (opcjonalnie)
                </label>
                <input
                  type="text"
                  value={shippingMethod}
                  onChange={(event) => {
                    setShippingMethodTouched(true);
                    setShippingMethod(event.target.value);
                  }}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
                  placeholder={carrierConfig.label}
                  disabled={isSubmitting}
                />
              </div>

              {previewUrl ? (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                  <span className="font-medium">Podgląd linku:</span>{" "}
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {previewUrl}
                  </a>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="rounded-md px-4 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-800"
                  onClick={closeDialog}
                  disabled={isSubmitting}
                >
                  Anuluj
                </button>
                <Button type="submit" variant="default" disabled={isSubmitting}>
                  {isSubmitting ? "Zapisywanie..." : "Zapisz i wyślij"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
