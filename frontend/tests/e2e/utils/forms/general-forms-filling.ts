import { Page, TestInfo } from "@playwright/test";
import { selectDropdownByValueOrLabel } from "tests/e2e/utils/select-dropdown-utils";

import { openForm } from "./form-navigation-utils";

export interface FillFieldDefinition {
  testId?: string;
  selector?: string;
  type: "text" | "dropdown" | "file";
  section?: string;
  field: string;
}

export type FormFillFieldDefinitions = {
  [fieldIdentifier: string]: FillFieldDefinition;
};

export interface FillFormConfig {
  formName: string | RegExp;
  fields: FormFillFieldDefinitions;
  saveButtonTestId: string;
  noErrorsText?: string;
}

export interface FormsFixtureData {
  formName: string;
  fields: FillFieldDefinition[];
}

export async function fillField(
  testInfo: TestInfo,
  page: Page,
  field: FillFieldDefinition,
  data: string,
): Promise<void> {
  const fieldIdentifier = field.section
    ? `${field.section}-${field.field}`
    : field.field;
  try {
    if (field.type === "dropdown" && field.selector) {
      await selectDropdownByValueOrLabel(page, field.selector, data);
    } else if (field.type === "text" && field.testId) {
      const locator = page.getByTestId(field.testId);
      await locator.waitFor({ state: "attached", timeout: 5000 });
      await locator.fill(data);
    } else if (field.type === "file" && (field.testId || field.selector)) {
      const locator = field.selector
        ? page.locator(field.selector)
        : page.getByTestId(field.testId!);
      // Use a generous timeout: Mobile Chrome renders the file input more slowly
      // than desktop Chrome, so 5000ms is insufficient.
      await locator.waitFor({ state: "attached", timeout: 30000 });
      await locator.scrollIntoViewIfNeeded();
      await locator.setInputFiles(data);
      // Wait for the uploaded filename to appear in the UI before proceeding.
      // Webkit renders the post-upload filename span more slowly, so use a
      // generous timeout matching the file-input wait above.
      const fileName = data.split("/").pop() ?? data;
      await page
        .locator(`span:has-text("${fileName}")`)
        .waitFor({ state: "visible", timeout: 30000 });
    } else {
      console.error("unsupported field type or selector type", field);
    }

    await testInfo.attach(`fillField-${fieldIdentifier}-success`, {
      body: `Successfully filled ${fieldIdentifier}: "${data}"`,
      contentType: "text/plain",
    });
  } catch (error) {
    await testInfo.attach(`fillField-${fieldIdentifier}-error`, {
      body: `Failed to fill ${fieldIdentifier}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      contentType: "text/plain",
    });

    throw new Error(
      `Failed to fill ${field.field}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Opens and fills a form from the application page, then saves it.
 * Consolidates the navigation reliability of `openForm` (table-scoped row
 * lookup, scroll-to-reveal, testId/href/button/global fallback selectors,
 * trial-click check, force-click retry, direct href goto last resort, and
 * URL pattern verification) with `fillForm`'s artifact attachment, field
 * filling, save, and optional return-to-application logic.
 *
 * Does NOT perform assertions - those should be done in the test.
 * Assumes the current page is already an application page where the forms
 * table is reachable.
 */
export async function fillForm(
  testInfo: TestInfo,
  page: Page,
  config: FillFormConfig,
  data: Record<string, string>,
  returnToApplication = true,
): Promise<void> {
  const { formName, fields, saveButtonTestId } = config;

  const applicationURL = page.url();

  await testInfo.attach("fillForm-applicationURL", {
    body: `Application URL: ${applicationURL}`,
    contentType: "text/plain",
  });

  // Derive a string matcher for openForm: if formName is already a string use
  // it directly; if it is a RegExp, use its source pattern so openForm can
  // construct the case-insensitive regex it expects.
  const formMatcher = formName instanceof RegExp ? formName.source : formName;

  try {
    // *********** Navigation ***********
    // Delegate to openForm, which owns all navigation reliability:
    // table-scoped row lookup, scroll-to-reveal, testId/href/button/global
    // fallback selectors, trial-click check, force-click retry, direct href
    // goto last resort, and URL pattern + load-state verification.
    const opened = await openForm(page, formMatcher);
    if (!opened) {
      throw new Error(`Could not find or open form: ${formMatcher}`);
    }

    // *********** Form ready check ***********
    // Confirm the form heading is visible before filling any fields.
    await page
      .getByText(formName)
      .first()
      .waitFor({ state: "visible", timeout: 35000 });

    // *********** Fill fields ***********

    for (const [fieldIdentifier, fieldConfig] of Object.entries(fields)) {
      await fillField(testInfo, page, fieldConfig, data[fieldIdentifier]);
    }

    await page.waitForTimeout(500);
    await page.getByTestId(saveButtonTestId).click();

    if (returnToApplication) {
      await page.goto(applicationURL);
    }
  } catch (error) {
    await testInfo.attach("fillForm-error", {
      body: error instanceof Error ? error.message : String(error),
      contentType: "text/plain",
    });
    throw error;
  }
}
