import { FACEBOOK_ORDER_URL } from "../order-link";

export type HelpArticle = {
  id: string;
  question: string;
  answer: string;
  link?: { label: string; href: string };
};

export type HelpCategory = { id: string; title: string; articles: HelpArticle[] };

const support = { label: "Contact Neffi Support", href: "/support" };

export const helpCategories: HelpCategory[] = [
  {
    id: "buying-ordering", title: "Buying & payment",
    articles: [
      { id: "price", question: "How much is a Neffi Digital Business Card?", answer: "A Neffi Digital Business Card is ₱799. Shipping is charged separately based on your delivery location." },
      { id: "included", question: "What comes with my ₱799 Neffi?", answer: "You get one physical Neffi NFC card connected to an editable digital profile. You can share your profile by tapping the card or by using your Sharing QR." },
      { id: "order", question: "How do I order?", answer: "Order through the official Neffi Facebook page. Send us a message, confirm your order and delivery details, then we’ll send the payment information before we prepare your card.", link: { label: "Order on Facebook", href: FACEBOOK_ORDER_URL } },
      { id: "payment", question: "What payment methods do you accept?", answer: "GCash, Maya, MariBank, GoTyme, and bank transfer. We’ll send the payment details during your order conversation." },
      { id: "cod", question: "Do you accept Cash on Delivery?", answer: "Not at the moment. Neffi currently processes prepaid orders so each order can be confirmed before packing and shipping." },
      { id: "cancel", question: "Can I cancel my order?", answer: "Yes, as long as your Neffi has not yet been shipped. Message us in the same Facebook conversation used for your order so we can check its status." },
      { id: "custom", question: "Can I customize the physical card?", answer: "Not yet. Neffi currently comes in the standard physical design shown on our website. Custom printing and personalized physical designs are not available at the moment." },
    ],
  },
  {
    id: "shipping", title: "Shipping & delivery",
    articles: [
      { id: "shipping-fee", question: "Is shipping included in ₱799?", answer: "No. Shipping is charged separately. We’ll check the J&T delivery fee based on your location and confirm the amount before payment." },
      { id: "delivery-time", question: "How long will delivery take?", answer: "Delivery time depends on J&T and your destination. Once your order has been shipped, we’ll send your tracking number so you can follow the delivery directly." },
      { id: "tracking", question: "When will I receive my tracking number?", answer: "We’ll send your J&T tracking number after your Neffi has been packed and handed over for shipping." },
      { id: "address", question: "Can I change my delivery address?", answer: "Contact us as soon as possible. We can update the delivery details if the order has not yet been handed over to the courier." },
      { id: "damaged", question: "My Neffi arrived damaged or doesn’t work. What should I do?", answer: "Contact Neffi Support as soon as possible and send clear photos or a short video showing the issue, including the packaging where relevant. We’ll review the problem and arrange an appropriate replacement or other remedy if the card arrived damaged or defective. Damage caused by misuse after delivery is not covered.", link: support },
    ],
  },
  {
    id: "activation", title: "Activation",
    articles: [
      { id: "package-qr", question: "What is the QR code on my package for?", answer: "The package QR opens Neffi activation. Scan it, enter the private activation code inside the package, then sign in to add the card to your account. Scanning the package QR again does not create a new card. If you already activated it, sign in to the account that owns your Neffi to manage it.", link: { label: "Follow the activation guide", href: "/guide#activation" } },
      { id: "activation-code", question: "Where is my activation code?", answer: "Your private activation code is printed inside the Neffi packaging. Keep this code private until the card has been added to your account." },
      { id: "two-qrs", question: "Why are there two different QR codes?", answer: "The QR on the packaging is for activating your Neffi. The Sharing QR on the back of the card opens your digital profile so other people can view it." },
      { id: "invalid-code", question: "My activation code isn’t working. What should I do?", answer: "Check the characters carefully, use the code from your own package, and try again without adding extra spaces. If the code is still rejected, contact Neffi Support.", link: support },
      { id: "wrong-account", question: "I added my Neffi to the wrong account. What should I do?", answer: "Do not try to create another ownership claim. An activated Neffi is associated with its owning account. Contact Neffi Support so we can review the card and account details.", link: support },
    ],
  },
  {
    id: "sharing", title: "Using & sharing",
    articles: [
      { id: "android", question: "Does Neffi work with Android phones?", answer: "Yes, on Android phones that support NFC. Some older or lower-end Android devices may not have NFC. If NFC isn’t available, the Sharing QR on the back of your Neffi card can be scanned with the phone’s camera instead." },
      { id: "android-nfc", question: "My Android phone supports NFC, but tapping does nothing.", answer: "On some Android phones, NFC can be turned off. Open the phone’s Settings and make sure NFC is enabled, then try tapping again near the phone’s NFC reading area. Other Android phones keep NFC ready automatically and do not require a separate setting." },
      { id: "no-nfc", question: "What if someone’s phone does not support NFC?", answer: "Use the Sharing QR on the back of your Neffi card. The other person can scan it with their phone’s camera to open your profile in their browser. They don’t need a Neffi account or app." },
      { id: "sharing-qr", question: "Where can I find my Sharing QR?", answer: "Your Sharing QR is printed on the back of your Neffi card. You can also access it from your card’s page in your Neffi account after your profile is set up.", link: { label: "Sign in to Neffi", href: "/sign-in" } },
    ],
  },
  {
    id: "account", title: "Account & card issues",
    articles: [
      { id: "sign-in-code", question: "I’m not receiving my sign-in code.", answer: "Confirm your email address, check spam or junk, and allow a short delivery delay. Request a new code if needed. If it still doesn’t arrive, contact Neffi Support.", link: support },
      { id: "lost-access", question: "I lost access to my email or Google account.", answer: "Contact Neffi Support for account recovery. We’ll need to verify the account before making ownership or sign-in changes.", link: support },
      { id: "missing-card", question: "My Neffi card isn’t showing in my account.", answer: "Make sure you’re signed in to the same account used when the card was activated. If the card is still missing, contact Neffi Support.", link: support },
      { id: "lost-card", question: "I lost my physical Neffi card. What should I do?", answer: "Your digital profile stays in your Neffi account, but someone who finds the physical card may still be able to open its public profile by tapping it or scanning its Sharing QR. Contact Neffi Support if you need help reviewing your next steps or arranging a replacement. A lost card is not treated as a damaged or defective product, so replacement costs may apply.", link: support },
    ],
  },
  {
    id: "troubleshooting", title: "Troubleshooting",
    articles: [
      { id: "tapping", question: "My phone doesn’t react when I tap the card.", answer: "Check that the phone supports NFC. On Android, enable NFC in Settings if that option is available; other phones keep NFC ready automatically. Try different positions near the phone’s NFC reader and remove very thick or metallic cases. Use the Sharing QR on the back of your card if tapping isn’t available. If the card still does not work on multiple compatible phones, contact Neffi Support.", link: support },
      { id: "unavailable-profile", question: "My profile says it isn’t available.", answer: "Make sure your profile is published, your card is turned on, and it is connected to the right profile in your Neffi account. If it should already be live, contact Neffi Support.", link: support },
      { id: "wrong-profile", question: "My card opens the wrong profile.", answer: "Stop using the card for sharing and contact Neffi Support so we can review the card and account association.", link: support },
      { id: "qr-not-working", question: "My Sharing QR isn’t working.", answer: "Open your card’s page in your Neffi account and use its current Sharing QR. If it still cannot be scanned or opens the wrong page, contact Neffi Support.", link: support },
    ],
  },
];

export const legacyHelpCategories: Record<string, string> = { "getting-started": "activation", profile: "sharing" };
