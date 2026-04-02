import { FORM_DEFAULTS } from "tests/e2e/utils/forms/form-defaults";
import { FormFillFieldDefinitions } from "tests/e2e/utils/forms/general-forms-filling";

// Regex matcher for SF-424D: matches both "SF-424D" and "Assurances for Construction Programs"
export const SF424D_FORM_MATCHER =
  "SF\\s*[-‑–—]?\\s*424D|Assurances\\s+for\\s+Construction\\s+Programs";

export const fieldDefinitionsSF424D: FormFillFieldDefinitions = {
  title: {
    testId: "title",
    type: "text",
    field: "Title",
  },
  applicant_organization: {
    testId: "applicant_organization",
    type: "text",
    field: "Applicant Organization",
  },
};

export const SF424D_FORM_CONFIG = {
  ...FORM_DEFAULTS,
  formName: new RegExp(SF424D_FORM_MATCHER, "i"),
  fields: fieldDefinitionsSF424D,
} as const;
