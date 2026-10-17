import { createCn } from "cn/config";

// The app's type-scale tokens are font sizes, so they must not be merged away as text colours.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["title", "section", "entity", "body", "meta", "label", "nav"] }],
    },
  },
});
