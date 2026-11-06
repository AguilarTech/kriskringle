# Design Specification: Kris Kringle App

**Theme:** Fruit Salad (Warm Cream & Chunky Color Blocks)  
**Target:** Mobile PWA (iOS Safari & Android Chrome)  
**Status:** Approved Specification  

---

## 1. Visual Identity & Design Principles

The design of the Kris Kringle PWA is inspired by the vibrant, cheerful aesthetic of Mexican *paleterías* combined with a modern, high-contrast flat mobile interface ("Fruit Salad"):
1. **Warm Cream Canvas:** Screens rest on a creamy coconut base (`#FFF6E8`), avoiding harsh stark-white displays while preserving high contrast.
2. **Chunky Rounded Geometry:** Cards, buttons, and badges feature generous corner radii (18px–30px) that evoke organic, handheld popsicle shapes.
3. **Flavour as the Hero:** Once the draw occurs, the player's shopping experience is anchored by their assigned flavour's signature color.
4. **Spoil-Proof Neutrals for Recipients:** Screens representing the user as recipient (e.g., "Chat with Your Santa") strictly use neutral dark ink and white backgrounds to avoid leaking any hue associated with their own secret flavour.
5. **No Emojis in Core UI:** Typography and dedicated graphic assets provide the personality. Emoji characters are excluded from UI labels and buttons to preserve aesthetic consistency.

---

## 2. Design Tokens

### 2.1 Core System Palette

| Token | Hex Value | Color Name | Intended Usage |
| :--- | :--- | :--- | :--- |
| `color-bg` | `#FFF6E8` | Coconut Cream | Primary screen background, subtle card fills |
| `color-ink` | `#1E1310` | Espresso Ink | Primary typography, dark buttons, high-contrast borders |
| `color-ink-muted` | `#635753` | Soft Espresso | Secondary helper text, timestamps, placeholders |
| `color-mango` | `#FFB627` | Mango Yellow | Primary CTA button background (with `color-ink` text) |
| `color-lemon` | `#FFE14D` | Lemon Zest | Survey card backgrounds (with `color-ink` text) |
| `color-lime` | `#9BD83A` | Key Lime | Secondary buttons, success pills, confirmation accents |
| `color-orange` | `#FF7A1A` | Sun Orange | Alert chips, unread count pills, active badges |
| `color-card-white` | `#FFFFFF` | Crisp White | Neutral chat bubbles, recipient views, modal surfaces |

### 2.2 The 18 Paleta Flavour Swatches

Each of the 18 flavours has a defined `hero_hex` and a paired `ink_hex` that satisfies WCAG AA contrast (≥ 4.5:1):

| Flavour Name | Hero Hex | Ink Hex | Contrast Ratio | Visual Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Hibiscus** | `#C2185B` | `#FFFFFF` | 5.2 : 1 | Deep magenta berry tone |
| **Chocolate** | `#4A2C21` | `#FFFFFF` | 9.8 : 1 | Rich dark Mexican cacao |
| **Mango** | `#FF9E00` | `#1E1310` | 6.4 : 1 | Golden tropical mango |
| **Lemon** | `#FFD600` | `#1E1310` | 10.5 : 1 | Punchy vibrant citrus yellow |
| **Lime** | `#7CB342` | `#1E1310` | 4.8 : 1 | Fresh zesty green |
| **Orange** | `#FF6D00` | `#1E1310` | 5.5 : 1 | Bright sunny citrus |
| **Raspberry** | `#D81B60` | `#FFFFFF` | 4.9 : 1 | Vivid crimson-pink |
| **Strawberry** | `#E53935` | `#FFFFFF` | 5.1 : 1 | Warm holiday strawberry red |
| **Watermelon** | `#E91E63` | `#FFFFFF` | 4.6 : 1 | Sweet summer melon pink |
| **Mandarin** | `#F4511E` | `#FFFFFF` | 4.7 : 1 | Deep sunset mandarin orange |
| **Blueberry** | `#3949AB` | `#FFFFFF` | 6.8 : 1 | Deep indigo blue |
| **Mojito** | `#43A047` | `#FFFFFF` | 4.6 : 1 | Fresh minty garden green |
| **Margarita** | `#C0CA33` | `#1E1310` | 6.1 : 1 | Tangy yellow-lime agave tone |
| **Kiwifruit** | `#6B8E23` | `#1E1310` | 4.8 : 1 | Olive kiwi green, brown skin band |
| **Horchata** | `#D7B48F` | `#1E1310` | 9.4 : 1 | Cinnamon rice-milk cream |
| **Screwdriver** | `#FFB300` | `#1E1310` | 10.1 : 1 | Golden orange-juice amber |
| **Kulfi** | `#F2C14E` | `#1E1310` | 10.8 : 1 | Saffron cardamom cream |
| **Melon** | `#AED581` | `#1E1310` | 10.9 : 1 | Pale honeydew green |

### 2.3 Typography

- **Display & Headings:** `Bricolage Grotesque`, weight 800 (Extra Bold). Used for flavour titles, large countdown numbers, and primary section headers.
- **Body & UI Controls:** `Inter`, weights 500 (Medium), 600 (Semi-Bold), and 700 (Bold). Used for survey questions, chat bodies, button labels, and small metadata.

### 2.4 Radii & Spacing Metrics

| Property | Value | Notes |
| :--- | :--- | :--- |
| `radius-button` | `18px` | Rounded pill-like tactile buttons |
| `radius-card` | `24px` | Outer boundary for survey cards and dialogs |
| `radius-hero` | `30px` | FlavourCard hero presentation banner |
| `radius-bubble` | `20px` | Chat speech bubbles with directional tails |
| `height-button-primary` | `56px` | Full thumb reach for mobile accessibility |
| `min-touch-target` | `44px` | Strict minimum for icon buttons and navigation items |
| `screen-padding` | `20px` | Standard horizontal gutter on viewport edges |

---

## 3. Paleta Graphic Assets

In accordance with product specs, paleta artwork uses high-resolution static PNG / WebP illustrations placed in the `/public/paletas` directory:

```
public/
└── paletas/
    ├── hibiscus.webp
    ├── chocolate.webp
    ├── mango.webp
    ├── lemon.webp
    ├── lime.webp
    ├── orange.webp
    ├── raspberry.webp
    ├── strawberry.webp
    ├── watermelon.webp
    ├── mandarin.webp
    ├── blueberry.webp
    ├── mojito.webp
    ├── margarita.webp
    ├── kiwifruit.webp
    ├── horchata.webp
    ├── screwdriver.webp
    ├── kulfi.webp
    ├── melon.webp
    └── generic-paleta.webp
```

Each graphic features a distinctively textured, illustrated Mexican paleta on a wooden stick, matching the corresponding flavor hero color.

---

## 4. Component Library & Component States

### 4.1 PaletaRow
- **Role:** Visual signature marquee used on Sign-In, Not Invited, and Loading states.
- **Layout:** Horizontal overflow-scroll row or centered cluster displaying 5 to 7 alternating paleta illustrations with subtle floating animations.

### 4.2 FlavourCard
- **Role:** The post-draw anchor on the Home screen.
- **Structure:**
  - Background: Flavour `hero_hex`.
  - Typography: White or dark `ink_hex` displaying:
    - Subtitle: `"YOU ARE SHOPPING FOR"`
    - Title: Flavour name in `Bricolage Grotesque 800` (e.g., `"HIBISCUS"`)
  - Illustration: Corresponding flavour paleta image (120px × 120px).
  - Footer: Compact button linking to the full survey answers.

### 4.3 SurveyCard
- **Role:** Displays question and answer pairs.
- **Structure:** Lemon card (`#FFE14D`) with dark espresso ink (`#1E1310`), rounded 24px corners. Includes question title (bold Inter) and family member answer in indented quotation block.

### 4.4 Action Buttons
- **Primary (`ButtonPrimary`):** Mango (`#FFB627`) with dark ink text. Height: 56px, Radius: 18px.
- **Secondary (`ButtonSecondary`):** Lime (`#9BD83A`) or neutral white with dark ink text.
- **Dark (`ButtonDark`):** Espresso Ink (`#1E1310`) with white text.
- **States:**
  - *Default:* Bold text, elevation shadow `0 4px 0 #1E1310`.
  - *Active / Pressed:* `transform: translateY(2px)`, shadow reduced to `0 2px 0 #1E1310`.
  - *Disabled:* Muted gray background (`#D8D0C5`), text color `#8C827A`, no shadow, `cursor: not-allowed`.
  - *Loading:* Inner spinner animation with label hidden.

### 4.5 ChatBubble & Weekly Quota Chip
- **Direction A (Sent by User):** Aligned right.
  - Flavour Chat: Styled in flavour's `hero_hex` with matching ink.
  - Santa Chat: Styled in crisp white (`#FFFFFF`) with ink border `1.5px solid #1E1310`.
- **Direction B (Received from Counterpart):** Aligned left. Light cream fill (`#F5EADB`) with dark ink text.
- **Quota Chip:** Positioned directly above the chat composer input:
  - If quota available: `1 message available this week (Resets Mon)` in green/lime pill.
  - If quota exhausted: `Weekly message sent! Resets in X days` in soft muted pill, and composer input is disabled.

### 4.6 Navigation Bar (BottomNav)
- **Role:** Persistent bottom tab bar fixed above mobile safe area.
- **Tabs (3 items):**
  1. `Home` (Popsicle Icon)
  2. `Chats` (Two Chat Bubbles Icon + Red Dot indicator if unread)
  3. `Missions` (Star / Checklist Icon)

---

## 5. Screen-by-Screen Specifications & Wireframes

### Screen 1: Sign-In Screen
- **Phase:** Any phase before authentication.
- **Header:** PaletaRow graphic banner.
- **Body:** App title ("Paleta Kris Kringle 2026"), festive tagline ("Double-blind. Zero spoilers. 100% Paletas.").
- **Action:** Full-width "Continue with Google" button with Google 'G' logo.
- **Footer:** Helper note: *"Only invited family email addresses are permitted."*

```
+------------------------------------------+
|  [ Paleta 1 ]  [ Paleta 2 ]  [ Paleta 3 ]|
|                                          |
|          PALETA KRIS KRINGLE             |
|                 2026                     |
|                                          |
|      Double-Blind Family Secret Santa    |
|                                          |
|      +----------------------------+      |
|      | [G]  Continue with Google  |      |
|      +----------------------------+      |
|                                          |
|    Only invited family emails get in.    |
+------------------------------------------+
```

### Screen 2: Not Invited (Unauthorized)
- **Condition:** Authenticated email is not present in `public.allowlist`.
- **Visual:** Lonely melted paleta illustration.
- **Message:** "Oops! [email@example.com] isn't on the family allowlist."
- **Action:** "Sign Out / Try Another Account" button.

### Screen 3: Set-up Wizard (Pre-Draw Phase)
When `app_state.phase = 'setup'`, authenticated players walk through a 3-step wizard:

```
+------------------------------------------+
| Step 1 of 3: Exclusions                  |
| Who CAN'T you buy for this year?         |
| (Spouse, person bought for last year)    |
|                                          |
| [ ] Aunt Maria                           |
| [X] Carlos (Spouse)                      |
| [ ] Sofia                                |
|                                          |
| +--------------------------------------+ |
| | Next: Fun Survey  ->                 | |
| +--------------------------------------+ |
+------------------------------------------+
```
- **Step 1 (Exclusions):** Multi-select checklist of family members.
- **Step 2 (Fun Survey):** Paginated cards with 4–5 engaging questions (e.g., "Your ideal Sunday morning?", "Snack you can't resist?", "Favorite coffee/tea beverage?"). Autosaves as the player types (debounced about 600 ms, and flushed immediately on blur and when leaving the step), with a small "Saving…" / "Saved" indicator.
- **Step 3 (Confirmation & Waiting Room):** Displays confetti graphics and a live countdown timer:
  `"You're all set! The draw takes place Saturday 5 Dec at 8:00 PM Melbourne Time."`

### Screen 4: Flavour Home (Post-Draw Phase)
When `app_state.phase = 'drawn'`:

```
+------------------------------------------+
| HIBISCUS                        [Days:18]|
| +--------------------------------------+ |
| | YOU ARE SHOPPING FOR:                | |
| | HIBISCUS                             | |
| | [ Illustrated Hibiscus Paleta WebP ] | |
| |                                      | |
| | [ View Hibiscus's Survey Answers > ] | |
| +--------------------------------------+ |
|                                          |
| Quick Actions:                           |
| +--------------------------------------+ |
| | Chat with Hibiscus (1 msg available) | |
| +--------------------------------------+ |
| | Chat with Your Santa                 | |
| +--------------------------------------+ |
|                                          |
| [ Home ]          [ Chats ]   [ Missions ]
+------------------------------------------+
```

### Screen 5: Flavour Survey Detail
- Displays all questions and answers submitted by your assigned flavour's owner.
- Absolutely zero identifying information (no names, emails, or profile pictures).
- Top bar contains a back button to Home.

### Screen 6: Chat with Your Flavour (You are Santa)
- Chat view dedicated to sending clues, questions, or holiday cheer to the person you are buying for.
- Hero header matches the flavour color.
- Input box shows the weekly counter chip:
  `"1 message available this week. Claude will rewrite your message to hide your voice."`
- Send button triggers confirmation: "Rewording and sending...".

### Screen 7: Chat with Your Santa (You are Recipient)
- **CRITICAL ANTI-SPOILER STYLING:** Rendered in monochrome neutral tones (Dark espresso ink and white cards). 
- The recipient has NO idea what their own flavour is, so NO flavour hero color is used on this screen.
- Sender header reads strictly: `"Your Secret Santa"`.

```
+------------------------------------------+
| < Back           Your Secret Santa       |
|                                          |
| +-----------------------------+          |
| | Santa: "Greetings! Do you   |          |
| | prefer savory or sweet tea?"|          |
| +-----------------------------+          |
|                                          |
|            +---------------------------+ |
|            | You: "Definitely sweet    | |
|            | chai tea!"                | |
|            +---------------------------+ |
|                                          |
| [ Chip: 0 messages left this week ]      |
| [ Message input disabled until Monday  ] |
+------------------------------------------+
```

### Screen 8: Missions (Lite) - Stretch Goal
- Displays list of family challenges (e.g., "Take a photo eating a real popsicle", "Slip a holiday compliment into conversation").
- Each item has a point value (e.g., `+10 pts`) and a `"Done"` action button.
- Leaderboard shows total points verified by the organiser.

---

## 6. Mobile & iOS PWA Requirements

1. **Safe Area Insets:** All screens enforce `env(safe-area-inset-bottom)` and `env(safe-area-inset-top)` padding so bottom navigation bars and floating buttons never clash with the iOS home indicator bar.
2. **Add to Home Screen Banner:** If the PWA is running inside Safari browser tabs rather than standalone mode, a non-intrusive floating guide banner appears at the bottom explaining how to tap the iOS Share icon and select *"Add to Home Screen"*.
3. **No Elastic Overscroll Bleed:** The root document locks viewport rubber-banding on background cream surfaces to feel like a high-grade native application.
