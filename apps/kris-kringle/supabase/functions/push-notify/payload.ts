// Notification text. Fixed wording only: never the message text, and never a
// flavour name, because a recipient must not see "their" flavour (and lock
// screens are visible to others). Tech spec §6.3.

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export function messagePayload(direction: "to_flavour" | "to_santa"): PushPayload {
  return direction === "to_flavour"
    // The flavour's owner (the recipient) receives this
    ? { title: "New message", body: "Your Secret Santa sent you a message.", url: "/chats/santa" }
    // The Santa receives this
    : { title: "New message", body: "Your flavour replied.", url: "/chats/flavour" };
}
