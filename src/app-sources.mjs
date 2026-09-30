/** Business applications read by the ADF Copy activity (PB-064 phase 4).
 *
 * Table sources name one object in the portable form shared with the
 * Databricks route: Salesforce object API names, and HubSpot tables by their
 * Lakeflow names mapped to the HubSpot 2.0 connector's table names. Types and
 * behaviour follow Microsoft Learn (accessed 2026-09-30): Salesforce V2 is GA
 * and reads with SOQL; HubSpot 2.0 is GA, reads named tables and has no query.
 * Jira 2.0 is not offered: its dataset needs an undocumented schema value and
 * its fixed table list has no issues table.
 */

/** Portable HubSpot table names with an equivalent in the ADF 2.0 connector. */
export const hubspotTables = {
  calls: "CRM.Engagements.Calls",
  companies: "CRM.Objects.Companies",
  contacts: "CRM.Objects.Contacts",
  deals: "CRM.Objects.Deals",
  emails: "CRM.Engagements.Emails",
  leads: "CRM.Objects.Leads",
  line_items: "CRM.Objects.Line_Items",
  marketing_campaigns: "Marketing.Campaigns",
  marketing_emails: "Marketing.Emails.Marketing_Emails",
  meetings: "CRM.Engagements.Meetings",
  notes: "CRM.Engagements.Notes",
  orders: "CRM.Commerce.Orders",
  owners: "CRM.Owners",
  products: "CRM.Objects.Products",
  tasks: "CRM.Engagements.Tasks",
  tickets: "CRM.Objects.Tickets",
};

export const appSources = {
  salesforce: {
    label: "Salesforce",
    dataset: "SalesforceV2Object",
    valid: (object) =>
      typeof object === "string" && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(object),
    hint: "a Salesforce object API name such as Account or Invoice__c",
    table: (s) => ({ objectApiName: s.object }),
    // SOQL selects only the reviewed contract fields; deleted records are excluded.
    source: (s, columns) => ({
      type: "SalesforceV2Source",
      query: `SELECT ${columns.map((c) => c.name).join(", ")} FROM ${s.object}`,
      includeDeletedObjects: false,
    }),
  },
  hubspot: {
    label: "HubSpot",
    dataset: "HubspotObject",
    valid: (object) => Object.hasOwn(hubspotTables, object),
    hint: `one of ${Object.keys(hubspotTables).join(", ")}`,
    table: (s) => ({ tableName: hubspotTables[s.object] }),
    // HubSpot 2.0 has no query; the reviewed column mapping selects fields.
    source: () => ({ type: "HubspotSource" }),
  },
};
