// FGO (Facturare Guvernamentala Online / eFactura ANAF) Integration Service
// Ref: https://www.anaf.ro/CompletareFactura/
// API: OAuth 2.0 + JSON upload + status polling

import { FgoInvoiceStatus } from "@prisma/client";

const FGO_ENABLED = process.env.EFATURA_ENABLED === "true";
const IS_SANDBOX = process.env.FGO_ENV !== "production";

const OAUTH_URL = process.env.FGO_OAUTH_URL || (IS_SANDBOX ? "https://sandbox.anaf.ro/oauth" : "https://logincert.anaf.ro/oauth");
const API_URL = process.env.FGO_API_URL || (IS_SANDBOX ? "https://sandbox.anaf.ro/api" : "https://api.anaf.ro/prod");
const CLIENT_ID = process.env.FGO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.FGO_CLIENT_SECRET || "";

export type FgoUploadResult = {
  ok: boolean;
  trackingId?: string;
  status: FgoInvoiceStatus | string;
  errors?: Array<{ code: string; message: string }>;
};

/** Dummy sandbox response — never fails, always returns trackingId */
function sandboxUpload(): FgoUploadResult {
  return {
    ok: true,
    trackingId: `SANDBOX-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    status: "SUBMITTED Ok" as unknown as FgoInvoiceStatus,
  };
}

async function getAccessToken(): Promise<string | null> {
  if (IS_SANDBOX) return "sandbox-token";
  if (!CLIENT_ID || !CLIENT_SECRET) return null;

  const params = new URLSearchParams();
  params.set("grant_type", "client_credentials");
  params.set("client_id", CLIENT_ID);
  params.set("client_secret", CLIENT_SECRET);
  params.set("scope", "upload");

  const res = await fetch(`${OAUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

export async function uploadInvoiceToFgo(invoiceJson: string): Promise<FgoUploadResult> {
  if (!FGO_ENABLED) {
    return { ok: false, status: "DRAFT_UPLOADED" as unknown as FgoInvoiceStatus, errors: [{ code: "EFATURA_DISABLED", message: "eFactura este dezactivata in .env" }] };
  }

  if (IS_SANDBOX) {
    // Dezvoltare / test — nu trimitem la ANAF
    console.log("[FGO SANDBOX] Simulare upload factura");
    return sandboxUpload();
  }

  const token = await getAccessToken();
  if (!token) {
    return { ok: false, status: "DRAFT_UPLOADED" as unknown as FgoInvoiceStatus, errors: [{ code: "OAUTH_FAILED", message: "Nu am putut obtine access token FGO" }] };
  }

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: invoiceJson,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      status: "SUBMITTED_ERRORS" as unknown as FgoInvoiceStatus,
      errors: data.errors || [{ code: `HTTP_${res.status}`, message: "Eroare tehnica la upload FGO" }],
    };
  }

  return {
    ok: true,
    trackingId: data.trackingId || data.id,
    status: "SUBMITTED_OK" as unknown as FgoInvoiceStatus,
  };
}

export async function checkFgoStatus(trackingId: string): Promise<FgoUploadResult> {
  if (!FGO_ENABLED) {
    return { ok: false, status: "DRAFT_UPLOADED" as unknown as FgoInvoiceStatus };
  }

  if (IS_SANDBOX) {
    return { ok: true, trackingId, status: "SUBMITTED_OK" as unknown as FgoInvoiceStatus };
  }

  const token = await getAccessToken();
  if (!token) {
    return { ok: false, status: "DRAFT_UPLOADED" as unknown as FgoInvoiceStatus };
  }

  const res = await fetch(`${API_URL}/status/${trackingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      status: "SUBMITTED_ERRORS" as unknown as FgoInvoiceStatus,
      errors: data.errors || [{ code: `HTTP_${res.status}`, message: "Eroare verificare status FGO" }],
    };
  }

  return {
    ok: data.status === "OK" || data.status === "ACCEPTED",
    trackingId,
    status: data.status?.toUpperCase() as FgoInvoiceStatus || ("DRAFT_UPLOADED" as unknown as FgoInvoiceStatus),
    errors: data.errors,
  };
}
