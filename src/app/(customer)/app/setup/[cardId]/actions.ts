"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import type { Db } from "@/modules/db";
import { connectCardToProfile } from "@/modules/cards/manage";
import { ProfileError } from "@/modules/profiles/errors";
import { createProfileFromSetup, getOwnedProfile, lockOwnedProfile, setProfileGoal, updateAppearance, updateIdentity, upsertContactBlock } from "@/modules/profiles/profiles";
import { ACCENTS, COLOR_MODES, LAYOUTS } from "@/modules/profiles/appearance-options";
import { emailSchema, identitySchema, linkSchema, type Identity } from "@/modules/profiles/rules";
import { isGoal } from "@/modules/profiles/goals";
import { ownedCards } from "@/modules/cards/owned";
import { fieldMessages, identityPhone, type DetailKey } from "../../profiles/[profileId]/identity/identity-values";

export type SetupState = { error?: string; fields?: string[]; messages?: Partial<Record<DetailKey, string>> };
const MESSAGES = {
  invalid: "Check the highlighted fields and try again.",
  limit_reached: "You've reached the limit for this. Remove one first.",
};
const text = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
};
const uuid = (value: string) => (z.uuid().safeParse(value).success ? value : notFound());
const identity = (profile: { fullName: string | null; headline: string | null; company: string | null; location: string | null; bio: string | null; phone: string | null; email: string | null; website: string | null }): Identity => {
  return {
    fullName: profile.fullName ?? "", headline: profile.headline, company: profile.company, location: profile.location,
    bio: profile.bio, phone: profile.phone, email: profile.email, website: profile.website,
  };
};
const invalid = (fields: string[]): SetupState => ({
  error: MESSAGES.invalid,
  fields: [...new Set(fields)],
  messages: Object.fromEntries(fields.filter((field): field is DetailKey => field in fieldMessages).map(field => [field, fieldMessages[field]])),
});

async function viewerId() {
  const authorization = await authorize("account");
  if (!authorization.ok) redirect("/sign-in?next=/app");
  return authorization.viewer.accountId;
}

async function withRoutedDraft<T>(accountId: string, cardId: string, mutate: (tx: Db, profile: Awaited<ReturnType<typeof lockOwnedProfile>>) => Promise<T>) {
  const card = (await ownedCards(db, accountId)).find(card => card.id === cardId);
  if (!card?.profileId) notFound();
  return db.transaction(async tx => {
    const profile = await lockOwnedProfile(tx, accountId, card.profileId!);
    if (profile.status !== "draft") notFound();
    return mutate(tx, profile);
  });
}

export async function saveYouAction(_previous: SetupState | undefined, data: FormData): Promise<SetupState> {
  const accountId = await viewerId();
  const cardId = uuid(text(data, "cardId"));
  const goal = data.get("goal");
  if (typeof goal !== "string" || (goal !== "" && !isGoal(goal))) notFound();
  const parsed = identitySchema.safeParse({
    fullName: text(data, "fullName"), headline: text(data, "headline"), company: text(data, "company"),
    location: text(data, "location"), bio: text(data, "bio"), phone: "", email: "", website: "",
  });
  if (!parsed.success) return invalid(parsed.error.issues.map(issue => String(issue.path[0])));
  try {
    const card = (await ownedCards(db, accountId)).find(card => card.id === cardId);
    if (!card) notFound();
    if (card.profileId) {
      const { phone: _phone, email: _email, website: _website, ...you } = parsed.data;
      await withRoutedDraft(accountId, cardId, async (tx, profile) => updateIdentity(tx, { accountId, profileId: profile.id, identity: { ...identity(profile), ...you } }));
    } else {
      await createProfileFromSetup(db, { accountId, cardId, goal: isGoal(goal) ? goal : null, identity: parsed.data });
    }
  } catch (error) {
    if (error instanceof ProfileError && error.code === "limit_reached") return { error: MESSAGES.limit_reached };
    if (error instanceof ProfileError) notFound();
    throw error;
  }
  redirect(`/app/setup/${cardId}?step=photo`);
}

export async function savePhotoAction(_previous: SetupState | undefined, data: FormData): Promise<SetupState> {
  const accountId = await viewerId();
  const cardId = uuid(text(data, "cardId"));
  const imageIsLogo = data.get("imageIsLogo");
  if (imageIsLogo !== "true" && imageIsLogo !== "false") return invalid([]);
  try {
    await withRoutedDraft(accountId, cardId, async (tx, profile) => updateIdentity(tx, { accountId, profileId: profile.id, imageIsLogo: imageIsLogo === "true", identity: identity(profile) }));
  } catch (error) {
    if (error instanceof ProfileError) notFound();
    throw error;
  }
  redirect(`/app/setup/${cardId}?step=contact`);
}

export async function saveContactAction(_previous: SetupState | undefined, data: FormData): Promise<SetupState> {
  const accountId = await viewerId();
  const cardId = uuid(text(data, "cardId"));
  const contact = z.object({ email: emailSchema, website: linkSchema(), saveContact: z.enum(["true", "false"]) }).safeParse({
    email: text(data, "email"), website: text(data, "website"), saveContact: data.get("saveContact"),
  });
  if (!contact.success) return invalid(contact.error.issues.map(issue => String(issue.path[0])));
  let failure: SetupState | undefined;
  try {
    await withRoutedDraft(accountId, cardId, async (tx, profile) => {
      const phone = identityPhone(text(data, "phone"), profile.phone);
      if (phone === null) { failure = invalid(["phone"]); return; }
      if (!phone && !contact.data.email && !contact.data.website) { failure = { error: "Add a phone number, email or website so people can reach you." }; return; }
      const next = { ...identity(profile), phone: phone || null, email: contact.data.email, website: contact.data.website };
      await updateIdentity(tx, { accountId, profileId: profile.id, identity: next });
      await upsertContactBlock(tx, { accountId, profileId: profile.id, saveContact: contact.data.saveContact === "true" });
    });
  } catch (error) {
    if (error instanceof ProfileError) notFound();
    throw error;
  }
  if (failure) return failure;
  redirect(`/app/setup/${cardId}?step=links`);
}

export async function saveLookAction(_previous: SetupState | undefined, data: FormData): Promise<SetupState> {
  const accountId = await viewerId();
  const cardId = uuid(text(data, "cardId"));
  const layout = z.enum(LAYOUTS).safeParse(text(data, "layout"));
  if (!layout.success) return invalid(["layout"]);
  try {
    await withRoutedDraft(accountId, cardId, async (tx, profile) => updateAppearance(tx, {
      accountId, profileId: profile.id, layout: layout.data, colorMode: profile.colorMode,
      accentColor: profile.accentColor ?? ACCENTS[0].hex,
    }));
  } catch (error) {
    if (error instanceof ProfileError) notFound();
    throw error;
  }
  redirect(`/app/setup/${cardId}?step=style`);
}

export async function saveStyleAction(_previous: SetupState | undefined, data: FormData): Promise<SetupState> {
  const accountId = await viewerId();
  const cardId = uuid(text(data, "cardId"));
  const style = z.object({
    colorMode: z.enum(COLOR_MODES),
    accentColor: z.string().refine(value => ACCENTS.some(accent => accent.hex === value)),
  }).safeParse({ colorMode: text(data, "colorMode"), accentColor: text(data, "accentColor") });
  if (!style.success) return invalid(style.error.issues.map(issue => String(issue.path[0])));
  try {
    await withRoutedDraft(accountId, cardId, async (tx, profile) => updateAppearance(tx, {
      accountId, profileId: profile.id, layout: profile.layout, ...style.data,
    }));
  } catch (error) {
    if (error instanceof ProfileError) notFound();
    throw error;
  }
  redirect(`/app/setup/${cardId}?step=review`);
}

export async function chooseProfileAction(data: FormData): Promise<void> {
  const accountId = await viewerId();
  const cardId = uuid(text(data, "cardId"));
  const profileId = uuid(text(data, "profileId"));
  try {
    await connectCardToProfile(db, { accountId, cardId, profileId });
  } catch (error) {
    if (error instanceof ProfileError) notFound();
    throw error;
  }
  redirect(`/app/profiles/${profileId}`);
}

export async function continueGoalAction(data: FormData): Promise<void> {
  const accountId = await viewerId();
  const cardId = uuid(text(data, "cardId"));
  const goal = data.get("goal");
  if (typeof goal !== "string" || (goal !== "" && !isGoal(goal))) notFound();
  const card = (await ownedCards(db, accountId)).find(card => card.id === cardId);
  if (!card) notFound();
  if (card.profileId) {
    const profile = await getOwnedProfile(db, accountId, card.profileId);
    if (profile?.status !== "draft") notFound();
    try {
      await setProfileGoal(db, { accountId, profileId: card.profileId, goal: isGoal(goal) ? goal : null });
    } catch (error) {
      if (error instanceof ProfileError) notFound();
      throw error;
    }
  }
  redirect(`/app/setup/${cardId}?step=you&goal=${goal}`);
}
