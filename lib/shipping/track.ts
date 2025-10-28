const CARRIER_DEFINITIONS = [
  {
    id: "inpost",
    label: "InPost",
    urlTemplate: "https://inpost.pl/sledzenie-przesylek?number={tracking}",
  },
  {
    id: "dpd",
    label: "DPD Polska",
    urlTemplate: "https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1={tracking}",
  },
  {
    id: "dhl",
    label: "DHL Parcel",
    urlTemplate:
      "https://www.dhl.com/pl-pl/home/narzedzia-do-wysylki/sledzenie.html?piececode={tracking}",
  },
  {
    id: "ups",
    label: "UPS",
    urlTemplate: "https://www.ups.com/track?loc=pl_PL&tracknum={tracking}",
  },
  {
    id: "gls",
    label: "GLS",
    urlTemplate: "https://gls-group.eu/pl/pl/sledzenie-przesylki?match={tracking}",
  },
  {
    id: "fedex",
    label: "FedEx",
    urlTemplate: "https://www.fedex.com/fedextrack/?trknbr={tracking}",
  },
  {
    id: "poczta_polska",
    label: "Poczta Polska",
    urlTemplate: "https://emonitoring.poczta-polska.pl/?numer={tracking}",
  },
  {
    id: "other",
    label: "Inny przewoźnik",
    urlTemplate: null,
  },
] as const;

export type CarrierId = (typeof CARRIER_DEFINITIONS)[number]["id"];

export type CarrierDefinition = {
  id: CarrierId;
  label: string;
  urlTemplate: string | null;
};

export type TrackingBuildOptions = {
  customUrl?: string | null;
};

export function listCarriers(): CarrierDefinition[] {
  return CARRIER_DEFINITIONS.slice();
}

export function getCarrier(id: string): CarrierDefinition | undefined {
  return CARRIER_DEFINITIONS.find((carrier) => carrier.id === id);
}

export function isKnownCarrier(id: string): id is CarrierId {
  return Boolean(getCarrier(id));
}

export function sanitizeTrackingNumber(value: string): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, "").toUpperCase();
}

export function buildTrackingUrl(
  carrierId: CarrierId,
  trackingNumber: string,
  options?: TrackingBuildOptions,
): string | null {
  const carrier = getCarrier(carrierId);
  if (!carrier) {
    return null;
  }

  if (!trackingNumber) {
    return null;
  }

  if (!carrier.urlTemplate) {
    if (options?.customUrl) {
      return options.customUrl;
    }

    return null;
  }

  return carrier.urlTemplate.replace("{tracking}", encodeURIComponent(trackingNumber));
}

export function resolveShippingMethod(
  carrierId: CarrierId,
  providedMethod: string | null | undefined,
): string {
  const trimmed = typeof providedMethod === "string" ? providedMethod.trim() : "";
  if (trimmed.length > 0) {
    return trimmed;
  }

  return getCarrier(carrierId)?.label ?? "Manual shipping";
}
