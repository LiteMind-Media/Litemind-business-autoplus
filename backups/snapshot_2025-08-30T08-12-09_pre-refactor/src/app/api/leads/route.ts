import { NextResponse } from "next/server";

// Basic email regex for quick validation (not exhaustive)
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(phone: string) {
  // Keep leading + then digits
  const trimmed = phone.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/[^0-9]/g, "");
  return plus + digits;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, email, country } = body || {};

    if (!name || !phone || !email || !country) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    if (!emailRe.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    const normalizedPhone = normalizePhone(phone);

    // Compose a new customer record skeleton. The main app relies on localStorage; here we mimic append via a revalidation signal pattern.
    // Since we cannot directly mutate browser localStorage from a server route, we return the new record so the form page (client) can merge it into local list.
    const newCustomer = {
      id: "lead_" + Date.now().toString(36),
      name: String(name).trim(),
      phone: normalizedPhone,
      email: String(email).trim().toLowerCase(),
      country: String(country).trim(),
      source: "Web Form",
      dateAdded: new Date().toISOString().slice(0, 10),
      // Default empty pipeline related fields.
      status: "",
      firstCallStatus: "",
      secondCallStatus: "",
      firstContactMade: "",
      secondContactMade: "",
    };

    return NextResponse.json({ success: true, customer: newCustomer });
  } catch {
    // Swallow parse details to avoid leaking internals; treat as bad request
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
