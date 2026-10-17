import type { Identity } from "@/modules/profiles/rules";
import { detailValues, type DetailErrors, type DetailKey, type DetailsProfile, type DetailValues } from "./identity-values";

export const DETAILS_TOASTS = {
  success: { title: "Details updated" },
  failure: { title: "Couldn’t save changes", description: "Your changes are still here. Try again.", priority: "high" as const },
};

export function initialDetailsState(profile: DetailsProfile) {
  const values = detailValues(profile);
  return { values, saved: values, savedPhone: profile.phone, errors: {} as DetailErrors, saving: false };
}

type DetailsState = ReturnType<typeof initialDetailsState>;
type DetailsEvent =
  | { type: "edit"; key: DetailKey; value: string }
  | { type: "errors"; errors: DetailErrors }
  | { type: "saving" }
  | { type: "settled" }
  | { type: "saved"; identity: Identity }
  | { type: "discard" };

export function detailsReducer(state: DetailsState, event: DetailsEvent): DetailsState {
  switch (event.type) {
    case "edit": return { ...state, values: { ...state.values, [event.key]: event.value }, errors: { ...state.errors, [event.key]: undefined } };
    case "errors": return { ...state, errors: event.errors };
    case "saving": return { ...state, saving: true };
    case "settled": return { ...state, saving: false };
    case "saved": {
      const values: DetailValues = detailValues(event.identity);
      return { ...state, values, saved: values, savedPhone: event.identity.phone, errors: {} };
    }
    case "discard": return { ...state, saved: state.values };
  }
}
