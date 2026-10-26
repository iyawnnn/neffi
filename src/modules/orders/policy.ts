export const NORMAL_DBC_UNIT_PRICE = 79_900;

export const NEW_PAYMENT_METHODS = ["gcash", "maya", "maribank", "gotyme", "bank_transfer"] as const;
export type NewPaymentMethod = typeof NEW_PAYMENT_METHODS[number];
export type OwnerDelivery = "in_person" | "jnt";
