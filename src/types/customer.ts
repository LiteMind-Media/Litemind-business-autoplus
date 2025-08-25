export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string; // extracted from original combined Contact Info if present
  country?: string; // lead country (added via public form)
  source: "Instagram" | "Facebook" | "TikTok" | "WhatsApp" | "Web Form" | "";
  dateAdded: string;
  firstCallDate: string;
  firstCallStatus:
    | "Voicemail"
    | "Answered"
    | "Interested"
    | "Not Interested"
    | "";
  notes: string;
  secondCallDate: string;
  secondCallStatus: "They Called" | "We Called" | "Voicemail" | "Answered" | "";
  secondCallNotes: string;
  finalCallDate: string;
  finalStatus: "Registered" | "Not Registered" | "Follow-up Needed" | "";
  finalNotes: string;
  // Extended optional enrichment fields
  pronouns?: string; // e.g. "she/her", "he/him", "they/them"
  device?: string; // e.g. "iOS", "Android", "Desktop"
  leadScore?: number; // heuristic 0-100
  lastUpdated?: string; // ISO date for last modification
  // WhatsApp enrichment
  lastMessageSnippet?: string; // truncated last message
  messageCount?: number; // number of messages in conversation
  // Duplicate merge metadata
  duplicatePhones?: string[]; // other raw phone variants merged
  duplicateLeadIds?: string[]; // other leadIds merged into this record
  duplicateDateAdds?: string[]; // additional dateAdded values from duplicates
}

export type CustomerField = keyof Customer;

export const SOURCE_OPTIONS = [
  "Instagram",
  "Facebook",
  "TikTok",
  "WhatsApp",
  "Web Form",
] as const;
export const FIRST_CALL_STATUS_OPTIONS = [
  "Voicemail",
  "Answered",
  "Interested",
  "Not Interested",
] as const;
export const SECOND_CALL_STATUS_OPTIONS = [
  "They Called",
  "We Called",
  "Voicemail",
  "Answered",
] as const;
export const FINAL_STATUS_OPTIONS = [
  "Registered",
  "Not Registered",
  "Follow-up Needed",
] as const;
